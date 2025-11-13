const HeuristicAnalyzer = require('./heuristic-analyzer');

/**
 * AnalysisBackendManager - Pluggable backend system for snapshot analysis
 *
 * Supports multiple analysis backends:
 * - heuristic: Free, fast, pattern-based (default)
 * - ollama: Free, AI-powered, local (requires Ollama installed)
 * - anthropic-api: Paid, highest quality, cloud (requires API key)
 */
class AnalysisBackendManager {
  constructor(sessionDir, config = {}) {
    this.sessionDir = sessionDir;
    this.config = {
      primaryBackend: config.primaryBackend || 'heuristic',
      enableOllama: config.enableOllama || false,
      enableAnthropicApi: config.enableAnthropicApi || false,
      ollamaConfig: config.ollamaConfig || {
        host: 'http://localhost:11434',
        model: 'llama3.2:3b',
        timeout: 10000
      },
      anthropicApiConfig: config.anthropicApiConfig || {
        model: 'claude-3-5-haiku-20241022',
        maxTokens: 1000
      }
    };
  }

  /**
   * Analyze conversation log with selected backend
   * @param {string} logPath - Path to conversation-log.jsonl
   * @param {string} sessionName - Session name
   * @returns {Promise<object>} Analysis result
   */
  async analyze(logPath, sessionName) {
    const backend = await this.selectBackend();

    try {
      let snapshot;

      switch (backend) {
        case 'heuristic':
          snapshot = HeuristicAnalyzer.analyze(logPath, sessionName);
          break;

        case 'ollama':
          snapshot = await this.analyzeWithOllama(logPath, sessionName);
          break;

        case 'anthropic-api':
          snapshot = await this.analyzeWithAnthropicApi(logPath, sessionName);
          break;

        default:
          // Fallback to heuristic
          snapshot = HeuristicAnalyzer.analyze(logPath, sessionName);
      }

      return {
        success: true,
        backend: backend,
        snapshot: snapshot
      };
    } catch (error) {
      // Fallback to heuristic on error
      return {
        success: true,
        backend: 'heuristic (fallback)',
        snapshot: HeuristicAnalyzer.analyze(logPath, sessionName),
        error: error.message
      };
    }
  }

  /**
   * Select backend based on availability and config
   * @returns {Promise<string>} Backend name
   */
  async selectBackend() {
    // Check Ollama if enabled
    if (this.config.enableOllama) {
      const ollamaAvailable = await this.isOllamaAvailable();
      if (ollamaAvailable) {
        return 'ollama';
      }
    }

    // Check Anthropic API if enabled
    if (this.config.enableAnthropicApi) {
      const apiAvailable = this.isAnthropicApiAvailable();
      if (apiAvailable) {
        return 'anthropic-api';
      }
    }

    // Default to heuristic (always available)
    return 'heuristic';
  }

  /**
   * Check if Ollama service is available
   * @returns {Promise<boolean>}
   */
  async isOllamaAvailable() {
    try {
      const http = require('http');
      const url = new URL(this.config.ollamaConfig.host);

      return new Promise((resolve) => {
        const req = http.get({
          hostname: url.hostname,
          port: url.port || 11434,
          path: '/api/tags',
          timeout: 2000
        }, (res) => {
          resolve(res.statusCode === 200);
        });

        req.on('error', () => resolve(false));
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });
      });
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if Anthropic API key is available
   * @returns {boolean}
   */
  isAnthropicApiAvailable() {
    return !!(process.env.ANTHROPIC_API_KEY);
  }

  /**
   * Analyze with Ollama (local LLM)
   * @param {string} logPath - Path to conversation log
   * @param {string} sessionName - Session name
   * @returns {Promise<string>} Snapshot content
   */
  async analyzeWithOllama(logPath, sessionName) {
    const LogParser = require('./log-parser');
    const parsed = LogParser.parse(logPath);

    if (!parsed.success || parsed.count === 0) {
      return HeuristicAnalyzer.analyze(logPath, sessionName);
    }

    const summary = parsed.summary;
    const patterns = LogParser.analyzeFilePatterns(parsed.interactions);

    // Build prompt for Ollama
    const prompt = `Analyze this coding session and extract key information:

Session: ${sessionName}
Duration: ${summary.timespanMinutes} minutes
Interactions: ${summary.totalInteractions}
Files modified: ${summary.filesModified}
Directories: ${patterns.directoryCount}

Primary file type: ${patterns.primaryFileType}
Most edited file: ${patterns.mostEditedFile?.path || 'N/A'}

File list:
${summary.fileList.slice(0, 10).join('\n')}

Based on this data, provide:
1. Brief summary (2-3 sentences): What likely happened in this session?
2. Focus area: What was the main type of work?
3. Key accomplishments: What was likely achieved?

Format as markdown with appropriate headings.`;

    try {
      const response = await this.callOllama(prompt);

      return `# Consolidated Snapshot: ${sessionName}
**Timestamp**: ${new Date().toISOString()}
**Method**: Ollama Local LLM (${this.config.ollamaConfig.model})
**Status**: Consolidated from conversation log

${response}

## Session Metrics
- **Duration**: ${summary.timespanMinutes} minutes
- **Interactions**: ${summary.totalInteractions}
- **Files Modified**: ${summary.filesModified}
- **Directories**: ${patterns.directoryCount}

## Modified Files
${summary.fileList.slice(0, 20).map(f => `- \`${f}\``).join('\n')}
${summary.filesModified > 20 ? `\n- ... and ${summary.filesModified - 20} more files` : ''}

## Notes
Analysis generated by Ollama running locally. For highest-quality analysis, configure Anthropic API via \`/session:config\`.
`;
    } catch (error) {
      // Fallback to heuristic on error
      throw new Error(`Ollama analysis failed: ${error.message}`);
    }
  }

  /**
   * Call Ollama API
   * @param {string} prompt - Analysis prompt
   * @returns {Promise<string>} Response text
   */
  async callOllama(prompt) {
    const http = require('http');
    const url = new URL(this.config.ollamaConfig.host);

    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        model: this.config.ollamaConfig.model,
        prompt: prompt,
        stream: false
      });

      const req = http.request({
        hostname: url.hostname,
        port: url.port || 11434,
        path: '/api/generate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: this.config.ollamaConfig.timeout
      }, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve(response.response || '');
          } catch (e) {
            reject(new Error('Failed to parse Ollama response'));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Ollama request timed out'));
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Analyze with Anthropic API (highest quality)
   * @param {string} logPath - Path to conversation log
   * @param {string} sessionName - Session name
   * @returns {Promise<string>} Snapshot content
   */
  async analyzeWithAnthropicApi(logPath, sessionName) {
    const LogParser = require('./log-parser');
    const parsed = LogParser.parse(logPath);

    if (!parsed.success || parsed.count === 0) {
      return HeuristicAnalyzer.analyze(logPath, sessionName);
    }

    const summary = parsed.summary;
    const patterns = LogParser.analyzeFilePatterns(parsed.interactions);

    // Build prompt for Claude
    const prompt = `Analyze this coding session and create a comprehensive snapshot:

Session: ${sessionName}
Duration: ${summary.timespanMinutes} minutes
Interactions: ${summary.totalInteractions}
Files modified: ${summary.filesModified}

Files:
${summary.fileList.slice(0, 15).join('\n')}

Provide:
1. **Summary** (2-3 paragraphs): What happened in this session?
2. **Key Accomplishments**: What was achieved?
3. **Decisions Made**: Technical choices or approaches taken
4. **Current State**: Where things stand, what's complete, what's next
5. **Notes**: Any observations about code quality, patterns, or concerns

Format as markdown with ## headings.`;

    try {
      const response = await this.callAnthropicApi(prompt);

      return `# Consolidated Snapshot: ${sessionName}
**Timestamp**: ${new Date().toISOString()}
**Method**: Anthropic API (${this.config.anthropicApiConfig.model})
**Status**: Consolidated from conversation log

${response}

## Session Metrics
- **Duration**: ${summary.timespanMinutes} minutes
- **Interactions**: ${summary.totalInteractions}
- **Files Modified**: ${summary.filesModified}
- **Directories**: ${patterns.directoryCount}

## Modified Files
${summary.fileList.slice(0, 20).map(f => `- \`${f}\``).join('\n')}
${summary.filesModified > 20 ? `\n- ... and ${summary.filesModified - 20} more files` : ''}
`;
    } catch (error) {
      throw new Error(`Anthropic API analysis failed: ${error.message}`);
    }
  }

  /**
   * Call Anthropic API
   * @param {string} prompt - Analysis prompt
   * @returns {Promise<string>} Response text
   */
  async callAnthropicApi(prompt) {
    const https = require('https');
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable not set');
    }

    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        model: this.config.anthropicApiConfig.model,
        max_tokens: this.config.anthropicApiConfig.maxTokens,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const req = https.request({
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.content && response.content[0] && response.content[0].text) {
              resolve(response.content[0].text);
            } else if (response.error) {
              reject(new Error(response.error.message || 'Anthropic API error'));
            } else {
              reject(new Error('Unexpected API response format'));
            }
          } catch (e) {
            reject(new Error('Failed to parse Anthropic API response'));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }
}

module.exports = AnalysisBackendManager;
