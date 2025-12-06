/**
 * Documentation Fetcher
 *
 * Fetches and caches documentation from URLs or local files.
 * Parses markdown, JSON, and YAML formats.
 * Extracts relevant sections for task context.
 */

const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const http = require('http');

/**
 * Cache expiry time (15 minutes)
 */
const CACHE_EXPIRY_MS = 15 * 60 * 1000;

class DocFetcher {
  /**
   * @param {Object} options
   * @param {string} options.cacheDir - Directory for caching docs
   * @param {string} options.projectRoot - Project root for local file resolution
   */
  constructor(options = {}) {
    this.cacheDir = options.cacheDir || '.claude/doc-cache';
    this.projectRoot = options.projectRoot || process.cwd();
    this._memoryCache = new Map();
  }

  /**
   * Fetch documentation from URL or local path
   * @param {string} source - URL or local file path
   * @param {Object} options
   * @param {string} options.section - Specific section to extract
   * @param {boolean} options.force - Force refresh, bypass cache
   * @returns {Promise<Object>}
   */
  async fetch(source, options = {}) {
    // Check memory cache first
    const cacheKey = `${source}:${options.section || ''}`;
    const cached = this._getCached(cacheKey);

    if (cached && !options.force) {
      return cached;
    }

    let content;

    if (this._isUrl(source)) {
      content = await this._fetchUrl(source);
    } else {
      content = await this._readLocal(source);
    }

    // Parse and extract relevant sections
    const parsed = this._parse(content, source, options.section);

    // Cache for future use
    this._setCached(cacheKey, parsed);

    return parsed;
  }

  /**
   * Fetch multiple documentation sources
   * @param {Array<string|Object>} sources - Array of URLs/paths or {source, section} objects
   * @returns {Promise<Object[]>}
   */
  async fetchAll(sources) {
    const results = [];

    for (const src of sources) {
      try {
        const source = typeof src === 'string' ? src : src.source || src.url || src.local;
        const section = typeof src === 'object' ? src.section : undefined;

        const doc = await this.fetch(source, { section });
        results.push({
          source,
          section,
          ...doc
        });
      } catch (err) {
        results.push({
          source: typeof src === 'string' ? src : src.source,
          error: err.message,
          sections: []
        });
      }
    }

    return results;
  }

  /**
   * Get documentation relevant to a specific task
   * @param {Object} task - Task object
   * @param {Object[]} allDocs - All fetched docs
   * @returns {Object[]}
   */
  getRelevantDocs(task, allDocs) {
    const relevant = [];
    const taskText = JSON.stringify(task).toLowerCase();

    // Extract keywords from task
    const taskKeywords = this._extractKeywords(taskText);

    for (const doc of allDocs) {
      if (!doc.sections || doc.error) continue;

      // Score each section by keyword overlap
      const scoredSections = doc.sections.map(section => {
        const sectionText = `${section.title || ''} ${section.content || ''}`.toLowerCase();
        const sectionKeywords = this._extractKeywords(sectionText);

        const overlap = taskKeywords.filter(kw => sectionKeywords.includes(kw));
        return {
          ...section,
          relevance: overlap.length
        };
      }).filter(s => s.relevance > 2);

      if (scoredSections.length > 0) {
        relevant.push({
          source: doc.source,
          sections: scoredSections.sort((a, b) => b.relevance - a.relevance).slice(0, 3)
        });
      }
    }

    return relevant.sort((a, b) => {
      const aMax = Math.max(...a.sections.map(s => s.relevance));
      const bMax = Math.max(...b.sections.map(s => s.relevance));
      return bMax - aMax;
    });
  }

  /**
   * Check if source is a URL
   */
  _isUrl(source) {
    return source.startsWith('http://') || source.startsWith('https://');
  }

  /**
   * Fetch content from URL
   */
  async _fetchUrl(url) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;

      const request = client.get(url, {
        headers: {
          'User-Agent': 'claude-session-plugin/1.0',
          'Accept': 'text/plain, text/markdown, application/json, text/html'
        },
        timeout: 10000
      }, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          return this._fetchUrl(response.headers.location).then(resolve).catch(reject);
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${url}`));
          return;
        }

        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve(data));
      });

      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error(`Timeout fetching: ${url}`));
      });
    });
  }

  /**
   * Read content from local file
   */
  async _readLocal(filePath) {
    // Resolve relative to project root
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.projectRoot, filePath);

    return fs.readFile(absolutePath, 'utf8');
  }

  /**
   * Parse content based on file type
   */
  _parse(content, source, targetSection) {
    const ext = this._getExtension(source);

    let parsed;

    switch (ext) {
      case 'md':
      case 'mdx':
        parsed = this._parseMarkdown(content, targetSection);
        break;

      case 'json':
        parsed = this._parseJson(content, targetSection);
        break;

      case 'yaml':
      case 'yml':
        parsed = this._parseYaml(content, targetSection);
        break;

      case 'html':
        parsed = this._parseHtml(content, targetSection);
        break;

      default:
        // Treat as plain text
        parsed = {
          sections: [{
            title: 'Content',
            content: content.substring(0, 5000)
          }],
          raw: content
        };
    }

    return {
      source,
      ...parsed,
      fetchedAt: new Date().toISOString()
    };
  }

  /**
   * Parse markdown content
   */
  _parseMarkdown(content, targetSection) {
    const sections = [];
    const lines = content.split('\n');

    let currentSection = null;
    let currentContent = [];
    let currentLevel = 0;

    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headerMatch) {
        // Save previous section
        if (currentSection) {
          sections.push({
            title: currentSection,
            level: currentLevel,
            content: currentContent.join('\n').trim()
          });
        }

        currentSection = headerMatch[2];
        currentLevel = headerMatch[1].length;
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    // Add last section
    if (currentSection) {
      sections.push({
        title: currentSection,
        level: currentLevel,
        content: currentContent.join('\n').trim()
      });
    }

    // Filter to target section if specified
    if (targetSection) {
      const filtered = sections.filter(s =>
        s.title.toLowerCase().includes(targetSection.toLowerCase())
      );

      return {
        sections: filtered.length > 0 ? filtered : sections,
        raw: content,
        filtered: filtered.length > 0
      };
    }

    return { sections, raw: content };
  }

  /**
   * Parse JSON content
   */
  _parseJson(content, targetSection) {
    try {
      const parsed = JSON.parse(content);
      const sections = [];

      // Convert top-level keys to sections
      for (const [key, value] of Object.entries(parsed)) {
        if (targetSection && !key.toLowerCase().includes(targetSection.toLowerCase())) {
          continue;
        }

        sections.push({
          title: key,
          content: typeof value === 'string' ? value : JSON.stringify(value, null, 2)
        });
      }

      return { sections, raw: content, parsed };
    } catch (err) {
      return {
        sections: [{ title: 'Content', content: content.substring(0, 5000) }],
        raw: content,
        parseError: err.message
      };
    }
  }

  /**
   * Parse YAML content (simplified - no external deps)
   */
  _parseYaml(content, targetSection) {
    // Simple YAML parsing for top-level keys
    const sections = [];
    const lines = content.split('\n');

    let currentKey = null;
    let currentContent = [];

    for (const line of lines) {
      const keyMatch = line.match(/^(\w+):\s*(.*)$/);

      if (keyMatch && !line.startsWith(' ') && !line.startsWith('\t')) {
        if (currentKey) {
          sections.push({
            title: currentKey,
            content: currentContent.join('\n').trim()
          });
        }

        currentKey = keyMatch[1];
        currentContent = keyMatch[2] ? [keyMatch[2]] : [];
      } else if (currentKey) {
        currentContent.push(line);
      }
    }

    if (currentKey) {
      sections.push({
        title: currentKey,
        content: currentContent.join('\n').trim()
      });
    }

    if (targetSection) {
      const filtered = sections.filter(s =>
        s.title.toLowerCase().includes(targetSection.toLowerCase())
      );
      return { sections: filtered.length > 0 ? filtered : sections, raw: content };
    }

    return { sections, raw: content };
  }

  /**
   * Parse HTML content (extract text)
   */
  _parseHtml(content, targetSection) {
    // Strip HTML tags for basic text extraction
    const text = content
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '\n')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();

    return {
      sections: [{ title: 'Content', content: text.substring(0, 10000) }],
      raw: content
    };
  }

  /**
   * Get file extension from source
   */
  _getExtension(source) {
    // Handle URLs with query strings
    const cleanPath = source.split('?')[0];
    const ext = path.extname(cleanPath).toLowerCase().slice(1);

    // Handle GitHub raw URLs
    if (source.includes('github.com') && !ext) {
      if (source.includes('README')) return 'md';
    }

    return ext || 'txt';
  }

  /**
   * Extract keywords from text
   */
  _extractKeywords(text) {
    return text
      .match(/\b[a-z]{3,}\b/g) || []
      .filter(word => !this._isStopWord(word));
  }

  /**
   * Check if word is a stop word
   */
  _isStopWord(word) {
    const stopWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all',
      'can', 'had', 'her', 'was', 'one', 'our', 'out', 'has',
      'have', 'been', 'this', 'that', 'with', 'they', 'from',
      'will', 'would', 'there', 'their', 'what', 'about', 'which',
      'when', 'make', 'like', 'time', 'just', 'know', 'take',
      'into', 'year', 'your', 'some', 'could', 'them', 'than',
      'then', 'now', 'look', 'only', 'come', 'its', 'over',
      'think', 'also', 'back', 'after', 'use', 'two', 'how',
      'first', 'well', 'way', 'even', 'new', 'want', 'because',
      'any', 'these', 'give', 'day', 'most', 'should', 'must',
      'function', 'return', 'const', 'let', 'var', 'import', 'export'
    ]);

    return stopWords.has(word);
  }

  /**
   * Get from memory cache
   */
  _getCached(key) {
    const entry = this._memoryCache.get(key);

    if (!entry) return null;

    // Check expiry
    if (Date.now() - entry.timestamp > CACHE_EXPIRY_MS) {
      this._memoryCache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set in memory cache
   */
  _setCached(key, data) {
    this._memoryCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear cache
   */
  clearCache() {
    this._memoryCache.clear();
  }
}

module.exports = { DocFetcher, CACHE_EXPIRY_MS };
