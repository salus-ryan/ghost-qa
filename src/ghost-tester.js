const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const { OllamaClient } = require('./ollama-client');

class GhostTester {
  constructor(config, callbacks) {
    this.config = {
      url: config.url || 'http://localhost:3000',
      interval: config.interval || 2000,
      avoidSelectors: config.avoidSelectors || ['[data-danger]', '.delete', '.remove', '[type="submit"][value*="delete" i]', 'button:has-text("delete")', 'button:has-text("remove")'],
      maxActions: config.maxActions || 100,
      screenshotOnError: config.screenshotOnError !== false,
      screenshotInterval: config.screenshotInterval || 5000,
      aiMode: config.aiMode || false,
      ollamaModel: config.ollamaModel || 'llama3.1:8b',
      ...config
    };
    
    this.callbacks = callbacks;
    this.browser = null;
    this.page = null;
    this.running = false;
    this.screenshotTimer = null;
    this.stats = {
      actionsPerformed: 0,
      errorsFound: 0,
      pagesVisited: 0,
      formsSubmitted: 0,
      startTime: null
    };
    this.visitedUrls = new Set();
    this.actionQueue = [];
    this.recentActions = [];
    this.ollama = null;
    this.aiAvailable = false;
  }

  async start() {
    this.running = true;
    this.stats.startTime = Date.now();
    
    this.log('info', `Starting Ghost QA for ${this.config.url}`);
    
    // Initialize Ollama if AI mode is enabled
    if (this.config.aiMode) {
      this.ollama = new OllamaClient({ model: this.config.ollamaModel });
      this.aiAvailable = await this.ollama.isAvailable();
      if (this.aiAvailable) {
        this.log('info', `🤖 AI Mode enabled with ${this.config.ollamaModel}`);
      } else {
        this.log('warning', '🤖 AI Mode requested but Ollama not available. Falling back to random mode.');
      }
    }
    
    try {
      this.browser = await chromium.launch({
        headless: false,
        args: ['--disable-web-security']
      });
      
      const context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: true
      });
      
      this.page = await context.newPage();
      
      // Listen for console errors
      this.page.on('console', msg => {
        if (msg.type() === 'error') {
          this.reportError('Console Error', msg.text());
        }
      });
      
      // Listen for page errors
      this.page.on('pageerror', error => {
        this.reportError('Page Error', error.message);
      });
      
      // Listen for response errors
      this.page.on('response', response => {
        if (response.status() >= 400) {
          this.reportError(`HTTP ${response.status()}`, `${response.url()} returned ${response.status()}`);
        }
      });
      
      // Navigate to initial URL
      await this.page.goto(this.config.url, { waitUntil: 'networkidle', timeout: 30000 });
      this.visitedUrls.add(this.config.url);
      this.stats.pagesVisited++;
      
      this.log('success', `Loaded ${this.config.url}`);
      
      // Start periodic screenshot capture
      this.startScreenshotCapture();
      
      // Start the testing loop
      this.testLoop();
      
    } catch (err) {
      this.log('error', `Failed to start: ${err.message}`);
      throw err;
    }
  }

  async testLoop() {
    while (this.running && this.stats.actionsPerformed < this.config.maxActions) {
      try {
        await this.performRandomAction();
        this.updateStats();
        await this.sleep(this.config.interval);
      } catch (err) {
        this.log('warning', `Action failed: ${err.message}`);
      }
    }
    
    if (this.stats.actionsPerformed >= this.config.maxActions) {
      this.log('info', `Reached max actions (${this.config.maxActions}). Stopping.`);
      await this.stop();
    }
  }

  async performRandomAction() {
    if (!this.page || !this.running) return;
    
    // Try AI-guided action if available
    if (this.config.aiMode && this.aiAvailable) {
      const aiAction = await this.performAIGuidedAction();
      if (aiAction) {
        this.stats.actionsPerformed++;
        return;
      }
      // Fall back to random if AI fails
    }
    
    const actionTypes = [
      { type: 'click', weight: 40 },
      { type: 'fillForm', weight: 25 },
      { type: 'navigate', weight: 20 },
      { type: 'scroll', weight: 10 },
      { type: 'hover', weight: 5 }
    ];
    
    const totalWeight = actionTypes.reduce((sum, a) => sum + a.weight, 0);
    let random = Math.random() * totalWeight;
    
    let selectedAction = 'click';
    for (const action of actionTypes) {
      random -= action.weight;
      if (random <= 0) {
        selectedAction = action.type;
        break;
      }
    }
    
    switch (selectedAction) {
      case 'click':
        await this.clickRandomElement();
        break;
      case 'fillForm':
        await this.fillRandomForm();
        break;
      case 'navigate':
        await this.navigateRandomLink();
        break;
      case 'scroll':
        await this.randomScroll();
        break;
      case 'hover':
        await this.hoverRandomElement();
        break;
    }
    
    this.stats.actionsPerformed++;
  }

  async performAIGuidedAction() {
    try {
      // Gather page context for the LLM
      const pageContext = await this.gatherPageContext();
      
      // Ask LLM to decide action
      const decision = await this.ollama.analyzePageAndDecideAction(pageContext);
      
      if (!decision || typeof decision.targetIndex !== 'number') {
        return false;
      }
      
      this.log('ai', `🤖 ${decision.reasoning}`);
      
      const elements = pageContext.elementHandles;
      const targetEl = elements[decision.targetIndex];
      
      if (!targetEl) {
        return false;
      }
      
      switch (decision.action) {
        case 'click':
          await targetEl.click({ timeout: 5000 });
          this.trackAction(`AI clicked: ${pageContext.elements[decision.targetIndex]?.text?.slice(0, 30) || 'element'}`);
          break;
          
        case 'fill':
          const fillValue = decision.fillValue || 'AI Test Input';
          await targetEl.fill(fillValue);
          this.trackAction(`AI filled: ${pageContext.elements[decision.targetIndex]?.name || 'field'} with "${fillValue.slice(0, 20)}"`);
          this.stats.formsSubmitted++;
          break;
          
        case 'navigate':
          await targetEl.click({ timeout: 5000 });
          await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
          this.trackAction(`AI navigated via: ${pageContext.elements[decision.targetIndex]?.text?.slice(0, 30) || 'link'}`);
          const currentUrl = this.page.url();
          if (!this.visitedUrls.has(currentUrl)) {
            this.visitedUrls.add(currentUrl);
            this.stats.pagesVisited++;
          }
          break;
          
        case 'hover':
          await targetEl.hover();
          this.trackAction(`AI hovered: ${pageContext.elements[decision.targetIndex]?.text?.slice(0, 30) || 'element'}`);
          break;
          
        case 'scroll':
          await this.randomScroll();
          break;
          
        default:
          return false;
      }
      
      return true;
    } catch (err) {
      this.log('warning', `AI action failed: ${err.message}`);
      return false;
    }
  }

  async gatherPageContext() {
    const url = this.page.url();
    const title = await this.page.title();
    
    // Get visible text (truncated)
    const visibleText = await this.page.evaluate(() => {
      return document.body?.innerText?.slice(0, 1000) || '';
    });
    
    // Get interactive elements
    const interactiveSelectors = 'button, a, input, textarea, select, [role="button"], [onclick], .clickable';
    const elementHandles = await this.page.$$(interactiveSelectors);
    
    const elements = [];
    const validHandles = [];
    
    for (const el of elementHandles) {
      try {
        const isVisible = await el.isVisible();
        const isEnabled = await el.isEnabled();
        
        if (!isVisible || !isEnabled) continue;
        
        const info = await el.evaluate(node => {
          const text = node.textContent?.trim().slice(0, 50) || '';
          const lowerText = text.toLowerCase();
          
          // Skip dangerous elements
          if (lowerText.includes('delete') || lowerText.includes('remove') || lowerText.includes('destroy')) {
            return null;
          }
          
          return {
            type: node.tagName.toLowerCase(),
            text,
            name: node.name || node.getAttribute('name') || node.getAttribute('aria-label') || '',
            placeholder: node.placeholder || '',
            inputType: node.type || '',
            href: node.href || ''
          };
        });
        
        if (info) {
          elements.push(info);
          validHandles.push(el);
        }
      } catch (e) {
        // Element may have been removed
      }
      
      // Limit to 30 elements to keep prompt manageable
      if (elements.length >= 30) break;
    }
    
    return {
      url,
      title,
      visibleText,
      elements,
      elementHandles: validHandles,
      recentActions: this.recentActions.slice(-10)
    };
  }

  trackAction(description) {
    this.recentActions.push(description);
    if (this.recentActions.length > 20) {
      this.recentActions.shift();
    }
    this.log('action', description);
  }

  async clickRandomElement() {
    const avoidSelector = this.config.avoidSelectors.join(', ');
    
    const clickableElements = await this.page.$$eval(
      'button, [role="button"], input[type="button"], input[type="submit"], a[href^="#"], .clickable, [onclick]',
      (elements, avoid) => {
        return elements
          .filter(el => {
            if (!el.offsetParent) return false; // Not visible
            if (el.disabled) return false;
            if (avoid && el.matches(avoid)) return false;
            const text = el.textContent?.toLowerCase() || '';
            if (text.includes('delete') || text.includes('remove') || text.includes('destroy')) return false;
            return true;
          })
          .map((el, i) => ({
            index: i,
            tag: el.tagName,
            text: el.textContent?.slice(0, 50) || '',
            type: el.type || ''
          }));
      },
      avoidSelector
    );
    
    if (clickableElements.length === 0) {
      this.log('info', 'No safe clickable elements found');
      return;
    }
    
    const randomEl = clickableElements[Math.floor(Math.random() * clickableElements.length)];
    
    try {
      const selector = `button, [role="button"], input[type="button"], input[type="submit"], a[href^="#"], .clickable, [onclick]`;
      const elements = await this.page.$$(selector);
      const safeElements = [];
      
      for (const el of elements) {
        const isVisible = await el.isVisible();
        const isEnabled = await el.isEnabled();
        if (isVisible && isEnabled) {
          const text = await el.textContent();
          const lowerText = (text || '').toLowerCase();
          if (!lowerText.includes('delete') && !lowerText.includes('remove') && !lowerText.includes('destroy')) {
            safeElements.push(el);
          }
        }
      }
      
      if (safeElements.length > 0) {
        const element = safeElements[Math.floor(Math.random() * safeElements.length)];
        const text = await element.textContent();
        await element.click({ timeout: 5000 });
        this.log('action', `Clicked: ${(text || 'element').slice(0, 30)}`);
      }
    } catch (err) {
      // Element may have been removed from DOM
    }
  }

  async fillRandomForm() {
    const inputs = await this.page.$$('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select');
    
    if (inputs.length === 0) {
      return;
    }
    
    const input = inputs[Math.floor(Math.random() * inputs.length)];
    
    try {
      const isVisible = await input.isVisible();
      const isEnabled = await input.isEnabled();
      
      if (!isVisible || !isEnabled) return;
      
      const tagName = await input.evaluate(el => el.tagName.toLowerCase());
      const inputType = await input.getAttribute('type') || 'text';
      const inputName = await input.getAttribute('name') || await input.getAttribute('placeholder') || 'field';
      
      if (tagName === 'select') {
        const options = await input.$$('option');
        if (options.length > 1) {
          const randomOption = options[Math.floor(Math.random() * (options.length - 1)) + 1];
          const value = await randomOption.getAttribute('value');
          await input.selectOption(value);
          this.log('action', `Selected option in: ${inputName}`);
        }
      } else if (inputType === 'checkbox' || inputType === 'radio') {
        await input.click();
        this.log('action', `Toggled: ${inputName}`);
      } else if (inputType === 'email') {
        await input.fill(`ghost${Date.now()}@test.com`);
        this.log('action', `Filled email: ${inputName}`);
      } else if (inputType === 'number') {
        await input.fill(String(Math.floor(Math.random() * 100)));
        this.log('action', `Filled number: ${inputName}`);
      } else if (inputType === 'tel') {
        await input.fill('555-123-4567');
        this.log('action', `Filled phone: ${inputName}`);
      } else if (inputType === 'url') {
        await input.fill('https://example.com');
        this.log('action', `Filled URL: ${inputName}`);
      } else if (inputType === 'date') {
        await input.fill('2024-01-15');
        this.log('action', `Filled date: ${inputName}`);
      } else {
        const testStrings = [
          'Ghost QA Test',
          'Lorem ipsum dolor sit amet',
          '12345',
          'test@example.com',
          '<script>alert("xss")</script>',
          '"; DROP TABLE users; --',
          '🎃👻',
          'A'.repeat(500)
        ];
        const testValue = testStrings[Math.floor(Math.random() * testStrings.length)];
        await input.fill(testValue);
        this.log('action', `Filled text: ${inputName}`);
      }
      
      this.stats.formsSubmitted++;
    } catch (err) {
      // Input may have been removed
    }
  }

  async navigateRandomLink() {
    const links = await this.page.$$('a[href]');
    const validLinks = [];
    
    for (const link of links) {
      try {
        const href = await link.getAttribute('href');
        const isVisible = await link.isVisible();
        
        if (!isVisible || !href) continue;
        if (href.startsWith('javascript:')) continue;
        if (href.startsWith('mailto:')) continue;
        if (href.startsWith('tel:')) continue;
        
        // Only navigate to same-origin links
        const url = new URL(href, this.config.url);
        const baseUrl = new URL(this.config.url);
        
        if (url.origin === baseUrl.origin) {
          validLinks.push({ element: link, href: url.href });
        }
      } catch (err) {
        // Invalid URL
      }
    }
    
    if (validLinks.length === 0) return;
    
    const randomLink = validLinks[Math.floor(Math.random() * validLinks.length)];
    
    try {
      await randomLink.element.click({ timeout: 5000 });
      await this.page.waitForLoadState('networkidle', { timeout: 10000 });
      
      const currentUrl = this.page.url();
      if (!this.visitedUrls.has(currentUrl)) {
        this.visitedUrls.add(currentUrl);
        this.stats.pagesVisited++;
        this.log('navigation', `Navigated to: ${currentUrl}`);
      }
    } catch (err) {
      // Navigation failed
    }
  }

  async randomScroll() {
    const scrollAmount = Math.floor(Math.random() * 500) - 250;
    await this.page.evaluate((amount) => {
      window.scrollBy(0, amount);
    }, scrollAmount);
    this.log('action', `Scrolled ${scrollAmount > 0 ? 'down' : 'up'} ${Math.abs(scrollAmount)}px`);
  }

  async hoverRandomElement() {
    const elements = await this.page.$$('button, a, [role="button"], .hoverable');
    
    if (elements.length === 0) return;
    
    const element = elements[Math.floor(Math.random() * elements.length)];
    
    try {
      const isVisible = await element.isVisible();
      if (isVisible) {
        await element.hover();
        this.log('action', 'Hovered element');
      }
    } catch (err) {
      // Element may have been removed
    }
  }

  async reportError(type, message) {
    this.stats.errorsFound++;
    
    const error = {
      type,
      message,
      url: this.page?.url() || this.config.url,
      timestamp: new Date().toISOString(),
      screenshot: null
    };
    
    if (this.config.screenshotOnError && this.page) {
      try {
        const screenshotDir = path.join(app.getPath('desktop'), 'ghost-qa-screenshots');
        if (!fs.existsSync(screenshotDir)) {
          fs.mkdirSync(screenshotDir, { recursive: true });
        }
        
        const filename = `error-${Date.now()}.png`;
        const filepath = path.join(screenshotDir, filename);
        await this.page.screenshot({ path: filepath, fullPage: true });
        error.screenshot = filepath;
        this.log('info', `Screenshot saved: ${filename}`);
      } catch (err) {
        // Screenshot failed
      }
    }
    
    this.log('error', `${type}: ${message}`);
    
    if (this.callbacks.onError) {
      this.callbacks.onError(error);
    }
  }

  log(level, message) {
    const log = {
      level,
      message,
      timestamp: new Date().toISOString()
    };
    
    if (this.callbacks.onLog) {
      this.callbacks.onLog(log);
    }
  }

  updateStats() {
    if (this.callbacks.onStats) {
      this.callbacks.onStats({
        ...this.stats,
        runtime: Date.now() - this.stats.startTime
      });
    }
  }

  getStats() {
    return {
      ...this.stats,
      runtime: this.stats.startTime ? Date.now() - this.stats.startTime : 0
    };
  }

  isRunning() {
    return this.running;
  }

  async stop() {
    this.running = false;
    this.log('info', 'Stopping Ghost QA...');
    
    // Stop screenshot timer
    if (this.screenshotTimer) {
      clearInterval(this.screenshotTimer);
      this.screenshotTimer = null;
    }
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
    
    this.log('info', `Session complete. Actions: ${this.stats.actionsPerformed}, Errors: ${this.stats.errorsFound}`);
  }

  startScreenshotCapture() {
    // Take initial screenshot
    this.captureScreenshot();
    
    // Set up periodic screenshots
    this.screenshotTimer = setInterval(() => {
      this.captureScreenshot();
    }, this.config.screenshotInterval);
  }

  async captureScreenshot() {
    if (!this.page || !this.running) return;
    
    try {
      const buffer = await this.page.screenshot({ type: 'jpeg', quality: 70 });
      const base64 = buffer.toString('base64');
      const dataUrl = `data:image/jpeg;base64,${base64}`;
      
      if (this.callbacks.onScreenshot) {
        this.callbacks.onScreenshot({
          dataUrl,
          url: this.page.url(),
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      // Page may be navigating
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { GhostTester };
