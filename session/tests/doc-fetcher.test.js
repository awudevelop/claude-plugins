/**
 * Unit tests for DocFetcher
 *
 * Tests documentation fetching, parsing, and caching.
 * Covers markdown, JSON, YAML, and HTML parsing.
 */

const path = require('path');
const fs = require('fs').promises;
const os = require('os');

// Module under test
const { DocFetcher, CACHE_EXPIRY_MS } = require('../cli/lib/doc-fetcher');

// Sample content for testing
const SAMPLE_MARKDOWN = `# API Documentation

## Introduction

This is the introduction section.

## Authentication

Authentication is done via API keys.

### API Key Setup

1. Go to settings
2. Generate a new key
3. Store it securely

## Endpoints

### GET /users

Returns a list of users.

### POST /users

Creates a new user.

## Error Handling

Errors are returned as JSON objects.
`;

const SAMPLE_JSON = JSON.stringify({
  name: 'test-api',
  version: '1.0.0',
  endpoints: {
    users: '/api/users',
    products: '/api/products'
  },
  authentication: {
    type: 'bearer',
    header: 'Authorization'
  }
}, null, 2);

const SAMPLE_YAML = `name: test-api
version: '1.0.0'
endpoints:
  users: /api/users
  products: /api/products
authentication:
  type: bearer
  header: Authorization
`;

const SAMPLE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>API Docs</title>
  <style>body { font-family: sans-serif; }</style>
</head>
<body>
  <h1>API Documentation</h1>
  <p>Welcome to our API documentation.</p>
  <script>console.log('test');</script>
  <div>
    <h2>Getting Started</h2>
    <p>Follow these steps to get started.</p>
  </div>
</body>
</html>
`;

describe('DocFetcher', () => {
  let fetcher;
  let tempDir;

  beforeEach(async () => {
    fetcher = new DocFetcher();
    tempDir = path.join(os.tmpdir(), `docfetcher-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    fetcher.clearCache();
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('Constants', () => {
    test('CACHE_EXPIRY_MS should be 15 minutes', () => {
      expect(CACHE_EXPIRY_MS).toBe(15 * 60 * 1000);
    });
  });

  describe('Constructor', () => {
    test('should create instance with default options', () => {
      const f = new DocFetcher();
      expect(f.cacheDir).toBe('.claude/doc-cache');
      expect(f.projectRoot).toBe(process.cwd());
    });

    test('should accept custom options', () => {
      const f = new DocFetcher({
        cacheDir: '/custom/cache',
        projectRoot: '/custom/project'
      });
      expect(f.cacheDir).toBe('/custom/cache');
      expect(f.projectRoot).toBe('/custom/project');
    });
  });

  describe('_isUrl', () => {
    test('should identify HTTP URLs', () => {
      expect(fetcher._isUrl('http://example.com')).toBe(true);
      expect(fetcher._isUrl('https://example.com')).toBe(true);
      expect(fetcher._isUrl('https://example.com/path/to/file.md')).toBe(true);
    });

    test('should identify non-URLs', () => {
      expect(fetcher._isUrl('/path/to/file.md')).toBe(false);
      expect(fetcher._isUrl('./relative/path.md')).toBe(false);
      expect(fetcher._isUrl('file.md')).toBe(false);
    });
  });

  describe('_getExtension', () => {
    test('should extract file extensions', () => {
      expect(fetcher._getExtension('file.md')).toBe('md');
      expect(fetcher._getExtension('file.json')).toBe('json');
      expect(fetcher._getExtension('file.yaml')).toBe('yaml');
      expect(fetcher._getExtension('file.yml')).toBe('yml');
      expect(fetcher._getExtension('file.html')).toBe('html');
    });

    test('should handle URLs with query strings', () => {
      expect(fetcher._getExtension('http://example.com/file.md?token=abc')).toBe('md');
      expect(fetcher._getExtension('http://example.com/api.json?v=1')).toBe('json');
    });

    test('should handle paths without extensions', () => {
      expect(fetcher._getExtension('http://example.com/file')).toBe('txt');
      expect(fetcher._getExtension('/path/without/extension')).toBe('txt');
    });

    test('should handle GitHub README URLs', () => {
      expect(fetcher._getExtension('https://github.com/user/repo/README')).toBe('md');
    });
  });

  describe('_parseMarkdown', () => {
    test('should parse markdown sections', () => {
      const result = fetcher._parseMarkdown(SAMPLE_MARKDOWN);

      expect(result.sections.length).toBeGreaterThan(0);
      expect(result.sections.find(s => s.title === 'API Documentation')).toBeDefined();
      expect(result.sections.find(s => s.title === 'Introduction')).toBeDefined();
      expect(result.sections.find(s => s.title === 'Authentication')).toBeDefined();
    });

    test('should track header levels', () => {
      const result = fetcher._parseMarkdown(SAMPLE_MARKDOWN);

      const h1 = result.sections.find(s => s.title === 'API Documentation');
      const h2 = result.sections.find(s => s.title === 'Introduction');
      const h3 = result.sections.find(s => s.title === 'API Key Setup');

      expect(h1.level).toBe(1);
      expect(h2.level).toBe(2);
      expect(h3.level).toBe(3);
    });

    test('should include section content', () => {
      const result = fetcher._parseMarkdown(SAMPLE_MARKDOWN);

      const intro = result.sections.find(s => s.title === 'Introduction');
      expect(intro.content).toContain('introduction section');
    });

    test('should filter by target section', () => {
      const result = fetcher._parseMarkdown(SAMPLE_MARKDOWN, 'Authentication');

      expect(result.filtered).toBe(true);
      expect(result.sections.some(s => s.title.includes('Authentication'))).toBe(true);
    });

    test('should return all sections if target not found', () => {
      const result = fetcher._parseMarkdown(SAMPLE_MARKDOWN, 'NonExistent');

      expect(result.filtered).toBe(false);
      expect(result.sections.length).toBeGreaterThan(0);
    });

    test('should preserve raw content', () => {
      const result = fetcher._parseMarkdown(SAMPLE_MARKDOWN);
      expect(result.raw).toBe(SAMPLE_MARKDOWN);
    });
  });

  describe('_parseJson', () => {
    test('should parse JSON and convert to sections', () => {
      const result = fetcher._parseJson(SAMPLE_JSON);

      expect(result.sections.length).toBeGreaterThan(0);
      expect(result.sections.find(s => s.title === 'name')).toBeDefined();
      expect(result.sections.find(s => s.title === 'endpoints')).toBeDefined();
    });

    test('should stringify nested objects', () => {
      const result = fetcher._parseJson(SAMPLE_JSON);

      const endpoints = result.sections.find(s => s.title === 'endpoints');
      expect(endpoints.content).toContain('/api/users');
    });

    test('should filter by target section', () => {
      const result = fetcher._parseJson(SAMPLE_JSON, 'authentication');

      expect(result.sections.some(s => s.title === 'authentication')).toBe(true);
      expect(result.sections.length).toBe(1);
    });

    test('should handle invalid JSON gracefully', () => {
      const result = fetcher._parseJson('not valid json {');

      expect(result.parseError).toBeDefined();
      expect(result.sections).toBeDefined();
    });

    test('should preserve parsed object', () => {
      const result = fetcher._parseJson(SAMPLE_JSON);
      expect(result.parsed).toBeDefined();
      expect(result.parsed.name).toBe('test-api');
    });
  });

  describe('_parseYaml', () => {
    test('should parse YAML top-level keys as sections', () => {
      const result = fetcher._parseYaml(SAMPLE_YAML);

      expect(result.sections.length).toBeGreaterThan(0);
      expect(result.sections.find(s => s.title === 'name')).toBeDefined();
      expect(result.sections.find(s => s.title === 'endpoints')).toBeDefined();
    });

    test('should include nested content', () => {
      const result = fetcher._parseYaml(SAMPLE_YAML);

      const endpoints = result.sections.find(s => s.title === 'endpoints');
      expect(endpoints.content).toContain('users');
    });

    test('should filter by target section', () => {
      const result = fetcher._parseYaml(SAMPLE_YAML, 'authentication');

      expect(result.sections.some(s => s.title === 'authentication')).toBe(true);
    });
  });

  describe('_parseHtml', () => {
    test('should strip HTML tags and extract text', () => {
      const result = fetcher._parseHtml(SAMPLE_HTML);

      expect(result.sections[0].content).toContain('API Documentation');
      expect(result.sections[0].content).toContain('Getting Started');
    });

    test('should remove script tags', () => {
      const result = fetcher._parseHtml(SAMPLE_HTML);

      expect(result.sections[0].content).not.toContain('console.log');
    });

    test('should remove style tags', () => {
      const result = fetcher._parseHtml(SAMPLE_HTML);

      expect(result.sections[0].content).not.toContain('font-family');
    });

    test('should limit content length', () => {
      const longHtml = '<div>' + 'x'.repeat(20000) + '</div>';
      const result = fetcher._parseHtml(longHtml);

      expect(result.sections[0].content.length).toBeLessThanOrEqual(10000);
    });
  });

  describe('_extractKeywords', () => {
    test('should extract words with 3+ characters', () => {
      const keywords = fetcher._extractKeywords('the quick brown fox jumps');
      expect(keywords).toContain('quick');
      expect(keywords).toContain('brown');
      expect(keywords).not.toContain('the');  // stop word
    });

    test('should filter stop words', () => {
      const keywords = fetcher._extractKeywords('this is a test with some words');
      expect(keywords).not.toContain('this');
      expect(keywords).not.toContain('with');
      expect(keywords).not.toContain('some');
    });

    test('should handle empty strings', () => {
      const keywords = fetcher._extractKeywords('');
      expect(keywords).toEqual([]);
    });
  });

  describe('_isStopWord', () => {
    test('should identify common stop words', () => {
      expect(fetcher._isStopWord('the')).toBe(true);
      expect(fetcher._isStopWord('and')).toBe(true);
      expect(fetcher._isStopWord('function')).toBe(true);
      expect(fetcher._isStopWord('return')).toBe(true);
    });

    test('should not mark regular words as stop words', () => {
      expect(fetcher._isStopWord('authentication')).toBe(false);
      expect(fetcher._isStopWord('user')).toBe(false);
      expect(fetcher._isStopWord('endpoint')).toBe(false);
    });
  });

  describe('Cache operations', () => {
    test('should cache and retrieve data', () => {
      const data = { test: 'value' };
      fetcher._setCached('test-key', data);

      const retrieved = fetcher._getCached('test-key');
      expect(retrieved).toEqual(data);
    });

    test('should return null for non-existent key', () => {
      const result = fetcher._getCached('non-existent');
      expect(result).toBeNull();
    });

    test('should clear cache', () => {
      fetcher._setCached('test-key', { test: 'value' });
      fetcher.clearCache();

      expect(fetcher._getCached('test-key')).toBeNull();
    });

    test('should respect cache expiry', async () => {
      // Mock the cache entry with old timestamp
      fetcher._memoryCache.set('old-key', {
        data: { old: 'data' },
        timestamp: Date.now() - CACHE_EXPIRY_MS - 1000  // Expired
      });

      const result = fetcher._getCached('old-key');
      expect(result).toBeNull();
    });
  });

  describe('fetch - local files', () => {
    test('should read local markdown file', async () => {
      const filePath = path.join(tempDir, 'test.md');
      await fs.writeFile(filePath, SAMPLE_MARKDOWN);

      const result = await fetcher.fetch(filePath);

      expect(result.source).toBe(filePath);
      expect(result.sections.length).toBeGreaterThan(0);
      expect(result.fetchedAt).toBeDefined();
    });

    test('should read local JSON file', async () => {
      const filePath = path.join(tempDir, 'test.json');
      await fs.writeFile(filePath, SAMPLE_JSON);

      const result = await fetcher.fetch(filePath);

      expect(result.source).toBe(filePath);
      expect(result.sections.length).toBeGreaterThan(0);
    });

    test('should read local YAML file', async () => {
      const filePath = path.join(tempDir, 'test.yaml');
      await fs.writeFile(filePath, SAMPLE_YAML);

      const result = await fetcher.fetch(filePath);

      expect(result.source).toBe(filePath);
      expect(result.sections.length).toBeGreaterThan(0);
    });

    test('should resolve relative paths from projectRoot', async () => {
      const f = new DocFetcher({ projectRoot: tempDir });
      await fs.writeFile(path.join(tempDir, 'docs.md'), SAMPLE_MARKDOWN);

      const result = await f.fetch('docs.md');

      expect(result.sections.length).toBeGreaterThan(0);
    });

    test('should use cache on repeated fetches', async () => {
      const filePath = path.join(tempDir, 'cached.md');
      await fs.writeFile(filePath, SAMPLE_MARKDOWN);

      // First fetch
      const result1 = await fetcher.fetch(filePath);
      const fetchedAt1 = result1.fetchedAt;

      // Second fetch (should use cache)
      const result2 = await fetcher.fetch(filePath);
      const fetchedAt2 = result2.fetchedAt;

      expect(fetchedAt1).toBe(fetchedAt2);
    });

    test('should bypass cache with force option', async () => {
      const filePath = path.join(tempDir, 'force.md');
      await fs.writeFile(filePath, SAMPLE_MARKDOWN);

      // First fetch
      const result1 = await fetcher.fetch(filePath);

      // Wait a tiny bit
      await new Promise(resolve => setTimeout(resolve, 10));

      // Force fetch
      const result2 = await fetcher.fetch(filePath, { force: true });

      expect(result2.fetchedAt).not.toBe(result1.fetchedAt);
    });

    test('should handle file not found', async () => {
      await expect(
        fetcher.fetch(path.join(tempDir, 'nonexistent.md'))
      ).rejects.toThrow();
    });
  });

  describe('fetchAll', () => {
    test('should fetch multiple sources', async () => {
      const mdPath = path.join(tempDir, 'test1.md');
      const jsonPath = path.join(tempDir, 'test2.json');

      await fs.writeFile(mdPath, SAMPLE_MARKDOWN);
      await fs.writeFile(jsonPath, SAMPLE_JSON);

      const results = await fetcher.fetchAll([mdPath, jsonPath]);

      expect(results).toHaveLength(2);
      expect(results[0].sections.length).toBeGreaterThan(0);
      expect(results[1].sections.length).toBeGreaterThan(0);
    });

    test('should handle source objects with section', async () => {
      const filePath = path.join(tempDir, 'sections.md');
      await fs.writeFile(filePath, SAMPLE_MARKDOWN);

      const results = await fetcher.fetchAll([
        { source: filePath, section: 'Authentication' }
      ]);

      expect(results[0].section).toBe('Authentication');
    });

    test('should handle failed fetches gracefully', async () => {
      const validPath = path.join(tempDir, 'valid.md');
      await fs.writeFile(validPath, SAMPLE_MARKDOWN);

      const results = await fetcher.fetchAll([
        validPath,
        path.join(tempDir, 'nonexistent.md')
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].sections.length).toBeGreaterThan(0);
      expect(results[1].error).toBeDefined();
    });
  });

  describe('getRelevantDocs', () => {
    test('should find relevant docs for a task', () => {
      // Task and docs must have 3+ keyword overlap after stop word filtering
      const task = {
        type: 'create_function',
        spec: {
          function: 'authenticateUser',
          does: 'Authenticate user credentials validate token session'
        }
      };

      const docs = [
        {
          source: 'api-docs.md',
          sections: [
            {
              title: 'Authentication',
              content: 'User authentication system validates credentials and manages token session. Authenticate requests properly.'
            },
            { title: 'Users', content: 'User management endpoints.' }
          ]
        },
        {
          source: 'other.md',
          sections: [
            { title: 'Unrelated', content: 'Completely different topic here.' }
          ]
        }
      ];

      const relevant = fetcher.getRelevantDocs(task, docs);

      expect(relevant.length).toBeGreaterThan(0);
      expect(relevant[0].source).toBe('api-docs.md');
    });

    test('should skip docs with errors', () => {
      const task = { type: 'create_function', spec: { function: 'test' } };
      const docs = [
        { source: 'error.md', error: 'Failed to fetch' }
      ];

      const relevant = fetcher.getRelevantDocs(task, docs);
      expect(relevant).toHaveLength(0);
    });

    test('should sort by relevance', () => {
      const task = {
        spec: { function: 'processPayment', does: 'Process payment with stripe' }
      };

      const docs = [
        {
          source: 'general.md',
          sections: [{ title: 'General', content: 'general information about payment' }]
        },
        {
          source: 'stripe.md',
          sections: [{ title: 'Stripe', content: 'process payment with stripe integration stripe api' }]
        }
      ];

      const relevant = fetcher.getRelevantDocs(task, docs);

      if (relevant.length > 1) {
        // More relevant doc should come first
        expect(relevant[0].source).toBe('stripe.md');
      }
    });

    test('should limit sections per doc', () => {
      const task = { spec: { function: 'test' } };
      const docs = [
        {
          source: 'many-sections.md',
          sections: Array(10).fill(null).map((_, i) => ({
            title: `Section ${i}`,
            content: 'test test test test'  // Will match
          }))
        }
      ];

      const relevant = fetcher.getRelevantDocs(task, docs);

      if (relevant.length > 0) {
        expect(relevant[0].sections.length).toBeLessThanOrEqual(3);
      }
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty markdown', () => {
      const result = fetcher._parseMarkdown('');
      expect(result.sections).toEqual([]);
    });

    test('should handle markdown with no headers', () => {
      const result = fetcher._parseMarkdown('Just plain text\nwith multiple lines');
      expect(result.sections).toHaveLength(0);
    });

    test('should handle empty JSON object', () => {
      const result = fetcher._parseJson('{}');
      expect(result.sections).toEqual([]);
    });

    test('should handle empty YAML', () => {
      const result = fetcher._parseYaml('');
      expect(result.sections).toEqual([]);
    });

    test('should handle HTML with no body content', () => {
      const result = fetcher._parseHtml('<html><body></body></html>');
      expect(result.sections[0].content).toBe('');
    });

    test('should handle very long content', async () => {
      const longContent = '# Header\n\n' + 'x'.repeat(10000);
      const filePath = path.join(tempDir, 'long.md');
      await fs.writeFile(filePath, longContent);

      const result = await fetcher.fetch(filePath);
      expect(result).toHaveProperty('sections');
    });

    test('should handle special characters in content', () => {
      const specialMd = '# Test\n\nContent with "quotes", <tags>, & ampersands';
      const result = fetcher._parseMarkdown(specialMd);
      expect(result.sections[0].content).toContain('quotes');
    });
  });
});
