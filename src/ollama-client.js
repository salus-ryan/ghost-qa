/**
 * Ollama Client for Ghost QA
 * Provides LLM-powered intelligent action selection
 */

const http = require('http');

class OllamaClient {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.model = config.model || 'llama3.1:8b';
    this.timeout = config.timeout || 30000;
  }

  /**
   * Generate a completion from Ollama
   */
  async generate(prompt, options = {}) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          num_predict: options.maxTokens || 500,
        }
      });

      const url = new URL('/api/generate', this.baseUrl);
      
      const req = http.request({
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        },
        timeout: this.timeout
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            resolve(json.response || '');
          } catch (e) {
            reject(new Error(`Failed to parse Ollama response: ${e.message}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Ollama request timed out'));
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * Check if Ollama is available
   */
  async isAvailable() {
    return new Promise((resolve) => {
      const url = new URL('/api/tags', this.baseUrl);
      
      const req = http.request({
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'GET',
        timeout: 5000
      }, (res) => {
        resolve(res.statusCode === 200);
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }

  /**
   * Analyze page and decide next action
   */
  async analyzePageAndDecideAction(pageContext) {
    const prompt = `You are an autonomous QA tester. Analyze this web page and decide the best action to test it.

PAGE CONTEXT:
- URL: ${pageContext.url}
- Title: ${pageContext.title}
- Visible Text (truncated): ${pageContext.visibleText?.slice(0, 500) || 'N/A'}

INTERACTIVE ELEMENTS:
${pageContext.elements.map((el, i) => `${i}. [${el.type}] "${el.text}" ${el.name ? `(name: ${el.name})` : ''}`).join('\n')}

RECENT ACTIONS:
${pageContext.recentActions?.slice(-5).join('\n') || 'None yet'}

RULES:
- NEVER click delete/remove/destroy buttons
- Prefer unexplored elements
- Fill forms with realistic test data
- Try to trigger edge cases and errors

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "action": "click" | "fill" | "navigate" | "scroll" | "hover",
  "targetIndex": <number from elements list>,
  "fillValue": "<value if action is fill>",
  "reasoning": "<brief explanation>"
}`;

    try {
      const response = await this.generate(prompt, { temperature: 0.3, maxTokens: 200 });
      
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return null;
    } catch (e) {
      console.error('Ollama analysis failed:', e.message);
      return null;
    }
  }

  /**
   * Generate smart form data based on field context
   */
  async generateFormData(fieldContext) {
    const prompt = `Generate realistic test data for this form field.

FIELD:
- Type: ${fieldContext.type}
- Name: ${fieldContext.name || 'unknown'}
- Placeholder: ${fieldContext.placeholder || 'none'}
- Label: ${fieldContext.label || 'none'}
- Current Value: ${fieldContext.currentValue || 'empty'}

PAGE CONTEXT: ${fieldContext.pageTitle || 'Unknown page'}

Generate a realistic value that would be used in a real application. For testing, occasionally include edge cases like:
- Very long strings
- Special characters
- Boundary values for numbers
- Empty strings (rarely)

Respond with ONLY the value to enter, nothing else.`;

    try {
      const response = await this.generate(prompt, { temperature: 0.8, maxTokens: 100 });
      return response.trim();
    } catch (e) {
      return null;
    }
  }

  /**
   * Analyze an error and suggest investigation steps
   */
  async analyzeError(errorContext) {
    const prompt = `Analyze this web application error and suggest what might have caused it.

ERROR:
- Type: ${errorContext.type}
- Message: ${errorContext.message}
- URL: ${errorContext.url}

RECENT ACTIONS:
${errorContext.recentActions?.join('\n') || 'None'}

Provide a brief analysis (2-3 sentences) of:
1. What likely caused this error
2. What the developer should check`;

    try {
      return await this.generate(prompt, { temperature: 0.3, maxTokens: 150 });
    } catch (e) {
      return null;
    }
  }
}

module.exports = { OllamaClient };
