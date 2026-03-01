# Browserless.io Integration for LM Studio

A powerful browser automation tool that integrates [Browserless.io](https://browserless.io) with LM Studio. This tool provides advanced web automation capabilities including stealth browsing, CAPTCHA solving, bot detection bypass, and cloud browser management.

## Features

### Core Capabilities
- **Screenshots**: Capture full page or element-specific screenshots in PNG, JPEG, or WebP
- **PDF Generation**: Convert web pages to PDFs with customizable formats and options
- **Web Scraping**: Extract structured data using CSS selectors
- **Content Extraction**: Get full HTML and text content from web pages
- **Unblock Protected Sites**: Bypass bot detection, CAPTCHAs, and Cloudflare challenges
- **BrowserQL**: Execute complex browser automation using GraphQL-based queries

### Advanced Features
- **Stealth Mode**: Advanced anti-bot detection and human-like behavior
- **CAPTCHA Solving**: Automatic CAPTCHA and Cloudflare challenge resolution
- **Regional Endpoints**: Choose from US West, UK, or Amsterdam for lower latency
- **Session Management**: Persistent browser sessions with reconnection support
- **Residential Proxies**: Built-in proxy rotation (requires Browserless plan)

## Prerequisites

- Node.js 18+ installed
- A [Browserless.io](https://browserless.io) account (free tier available)
- Browserless API token from your [dashboard](https://browserless.io/account/)

## Installation

1. **Install Dependencies**
   ```bash
   cd Browserless
   npm install
   ```

2. **Configure Environment**
   Create a `.env` file in the `Browserless` directory:
   ```env
   # Required: Your Browserless API token
   BROWSERLESS_API_KEY=your-api-token-here
   
   # Optional: Default region (production-sfo, production-lon, production-ams)
   BROWSERLESS_DEFAULT_REGION=production-sfo
   
   # Optional: Timeout settings
   BROWSERLESS_DEFAULT_TIMEOUT_MS=30000
   BROWSERLESS_MAX_TIMEOUT_MS=120000
   
   # Optional: Concurrency limit for simultaneous requests
   BROWSERLESS_CONCURRENCY_LIMIT=5
   
   # Optional: HTTP server port
   PORT=3003
   ```

3. **Build the Project**
   ```bash
   npm run build
   ```

## Usage

### As MCP Server (for LM Studio)

Add this configuration to your LM Studio `mcp.json`:

```json
{
  "mcpServers": {
    "browserless": {
      "command": "node",
      "args": ["C:/Users/YOUR_USERNAME/Development/llm-toolkit/Browserless/dist/mcp-server.js"],
      "env": {
        "BROWSERLESS_API_KEY": "your-api-token-here",
        "BROWSERLESS_DEFAULT_REGION": "production-sfo",
        "BROWSERLESS_DEFAULT_TIMEOUT_MS": "30000",
        "BROWSERLESS_MAX_TIMEOUT_MS": "120000",
        "BROWSERLESS_CONCURRENCY_LIMIT": "5"
      }
    }
  }
}
```

**Note**: Update the path to match your installation directory.

### As HTTP Server

Start the HTTP server:
```bash
npm start
```

The server will run on `http://localhost:3003` (or the port specified in `.env`).

## Available Tools

### 1. browserless_screenshot
Captures a screenshot of a web page.

**Parameters:**
- `apiKey` (optional): Browserless API key
- `url` (required): URL to screenshot
- `fullPage` (optional): Capture full scrollable page
- `type` (optional): Image format (png, jpeg, webp)
- `quality` (optional): Image quality 0-100
- `selector` (optional): CSS selector for specific element
- `waitForTimeout` (optional): Wait time before screenshot
- `waitForSelector` (optional): Wait for element before screenshot
- `region` (optional): Regional endpoint
- `timeoutMs` (optional): Request timeout

**Example:**
```json
{
  "url": "https://example.com",
  "fullPage": true,
  "type": "png"
}
```

### 2. browserless_pdf
Generates a PDF from a web page.

**Parameters:**
- `apiKey` (optional): Browserless API key
- `url` (required): URL to convert to PDF
- `format` (optional): Page format (A4, Letter, Legal, etc.)
- `landscape` (optional): Use landscape orientation
- `printBackground` (optional): Include background graphics
- `scale` (optional): Scale factor (0.1-2)
- `waitForTimeout` (optional): Wait time before PDF generation
- `waitForSelector` (optional): Wait for element before PDF
- `region` (optional): Regional endpoint
- `timeoutMs` (optional): Request timeout

**Example:**
```json
{
  "url": "https://example.com",
  "format": "A4",
  "landscape": false,
  "printBackground": true
}
```

### 3. browserless_scrape
Extracts structured data using CSS selectors.

**Parameters:**
- `apiKey` (optional): Browserless API key
- `url` (required): URL to scrape
- `elements` (required): Array of selectors to extract
- `waitForTimeout` (optional): Wait time before scraping
- `waitForSelector` (optional): Wait for element before scraping
- `region` (optional): Regional endpoint
- `timeoutMs` (optional): Request timeout

**Example:**
```json
{
  "url": "https://news.ycombinator.com",
  "elements": [
    {"selector": ".titleline"},
    {"selector": ".score"}
  ]
}
```

### 4. browserless_content
Extracts full HTML and text content from a page.

**Parameters:**
- `apiKey` (optional): Browserless API key
- `url` (required): URL to extract content from
- `waitForTimeout` (optional): Wait time before extraction
- `waitForSelector` (optional): Wait for element before extraction
- `region` (optional): Regional endpoint
- `timeoutMs` (optional): Request timeout

**Example:**
```json
{
  "url": "https://example.com"
}
```

### 5. browserless_unblock
Bypasses bot detection and CAPTCHAs on protected sites.

**Parameters:**
- `apiKey` (optional): Browserless API key
- `url` (required): URL to unblock
- `cookies` (optional): Return cookies
- `content` (optional): Return page content
- `screenshot` (optional): Return screenshot
- `browserWSEndpoint` (optional): Return WebSocket endpoint for Puppeteer/Playwright
- `region` (optional): Regional endpoint
- `timeoutMs` (optional): Request timeout

**Example:**
```json
{
  "url": "https://protected-site.com",
  "content": true,
  "screenshot": true
}
```

### 6. browserless_bql
Executes complex browser automation using BrowserQL (GraphQL-based browser automation language). 

**Parameters:**
- `apiKey` (optional): Browserless API key
- `query` (required): BrowserQL GraphQL mutation
- `variables` (optional): GraphQL variables
- `operationName` (optional): Operation name
- `region` (optional): Regional endpoint
- `timeoutMs` (optional): Request timeout

**Session Recording:**
All BQL queries are recorded by default (`replay=true`) for debugging and replay in the Browserless IDE. Access recorded sessions in your [Browserless Dashboard](https://browserless.io/account/).

**BrowserQL Capabilities:** 

1. **Stealth & Bot-Detection Evasion**
   - Use `/stealth/bql` endpoint for anti-detection
   - Human-like fingerprints and randomized behavior
   - Residential and third-party proxy integration

2. **Navigation**
   - `goto` mutation with `waitUntil` conditions (firstMeaningfulPaint, networkIdle, load, etc.)

3. **Page Interaction**
   - `click`: Humanized clicking with scrolling and visibility checks
   - `type`: Typing with randomized delays for human-like behavior
   - Deep selectors for iframes and shadow DOM

4. **Form Handling**
   - Fill inputs, select dropdowns, click buttons
   - Multi-field form automation with CAPTCHA solving

5. **Waiting & Synchronization**
   - `waitForNavigation`, `waitForRequest`, `waitForResponse`
   - `waitForSelector`, `waitForTimeout`

6. **Data Extraction**
   - `text` mutation: Extract text content
   - `html` mutation: Extract HTML

7. **CAPTCHA Solving**
   - `solve` mutation: Solves Cloudflare, reCAPTCHA, hCaptcha, etc.

8. **Media Capture**
   - `screenshot` mutation: Capture page or elements as base64

9. **Session & State Management**
   - `reconnect` mutation: Get `browserWSEndpoint` for Puppeteer/Playwright handoff
   - Session API: Persistent sessions with cookies and storage

10. **Hybrid Automation**
    - Use BQL for stealth, then reconnect to Puppeteer for continued automation

11. **IDE & Developer Tooling**
    - Web IDE with live browser view
    - Query history and replay
    - Export queries to multiple languages

**Documentation:**
- [BrowserQL Start Guide](https://docs.browserless.io/browserql/start)
- [BQL Schema Reference](https://docs.browserless.io/bql-schema/schema)
- [BrowserQL IDE](https://browserless.io/account/bql-ide)

**Example:**
```json
{
  "query": "mutation ScrapeHN { goto(url: \"https://news.ycombinator.com\", waitUntil: firstMeaningfulPaint) { status } firstHeadline: text(selector: \".titleline\") { text } }",
  "operationName": "ScrapeHN"
}
```

### 7. browserless_function
Executes custom Puppeteer code server-side. Use for complex automation scenarios not covered by other REST APIs.

**Parameters:**
- `apiKey` (optional): Browserless API key
- `code` (required): JavaScript/Puppeteer code to execute
- `context` (optional): Context object passed to the code
- `region` (optional): Regional endpoint
- `timeoutMs` (optional): Request timeout

**Use Cases:**
- Complex multi-step automation
- Conditional logic based on page content
- Custom data extraction and transformation

**Example:**
```json
{
  "code": "const data = []; await page.goto('https://example.com'); const items = await page.$$('.item'); for(const item of items) { data.push(await item.evaluate(el => el.textContent)); } return data;"
}
```

### 8. browserless_download
Downloads files that Chrome downloads during Puppeteer code execution.

**Parameters:**
- `apiKey` (optional): Browserless API key
- `code` (required): Puppeteer code that triggers file download
- `context` (optional): Context object passed to the code
- `region` (optional): Regional endpoint
- `timeoutMs` (optional): Request timeout

**Returns:**
- `base64`: File content as base64-encoded string
- `filename`: Original filename
- `contentType`: MIME type

**Example:**
```json
{
  "code": "await page.goto('https://example.com/download'); const downloadPromise = page.waitForEvent('download'); await page.click('a[download]'); await downloadPromise.path();"
}
```

### 9. browserless_export
Fetches a URL and exports/streams its native content type. Optionally bundles all resources as a ZIP file.

**Parameters:**
- `apiKey` (optional): Browserless API key
- `url` (required): URL to fetch and export
- `includeResources` (optional): If true, includes all resources as ZIP
- `region` (optional): Regional endpoint
- `timeoutMs` (optional): Request timeout

**Returns:**
- `base64`: Content as base64-encoded string
- `contentType`: MIME type

**Example:**
```json
{
  "url": "https://example.com/document.pdf",
  "includeResources": false
}
```

### 10. browserless_performance
Runs Lighthouse performance audits on a URL.

**Parameters:**
- `apiKey` (optional): Browserless API key
- `url` (required): URL to audit
- `config` (optional): Lighthouse configuration options
- `region` (optional): Regional endpoint
- `timeoutMs` (optional): Request timeout

**Returns:**
- `scores`: performance, accessibility, bestPractices, seo (0-100)
- `metrics`: FCP, LCP, CLS, TTI, TBT

**Example:**
```json
{
  "url": "https://example.com",
  "config": {
    "onlyCategories": ["performance", "best-practices"]
  }
}
```

## Regional Endpoints

- `production-sfo`: US West (San Francisco)
- `production-lon`: Europe UK (London)
- `production-ams`: Europe Amsterdam

## Concurrency Limit

The built-in concurrency limiter prevents overwhelming your API quota. The default limit is **5 simultaneous requests**.

**How it works:**
- Requests are queued when the limit is reached
- Each request waits for an active request to complete
- No requests are rejected; they're delayed until capacity is available

**Configuration:**
```env
BROWSERLESS_CONCURRENCY_LIMIT=10
```

**Recommendations:**
- **Free tier**: 2-5 concurrent requests
- **Pro tier**: 5-10 concurrent requests
- **Enterprise**: Adjust based on your plan limits

## API Key Management

Provide the API key via (in order of precedence):
1. **Per-request**: Include `apiKey` parameter
2. **Environment variable**: Set `BROWSERLESS_API_KEY` in `.env`
3. **MCP configuration**: Set in the `env` section of `mcp.json`

**Security Note**: Never commit API keys to version control.

## BrowserQL Examples

### Basic Navigation and Scraping
```graphql
mutation BasicScrape {
  goto(url: "https://example.com", waitUntil: firstMeaningfulPaint) {
    status
    time
  }
  title: text(selector: "h1") {
    text
  }
  description: text(selector: "p.intro") {
    text
  }
}
```

### Form Filling with CAPTCHA Solving
```graphql
mutation FormFill {
  goto(url: "https://example.com/form", waitUntil: networkIdle) {
    status
  }
  emailInput: type(selector: "#email", text: "user@example.com", delay: 50) {
    time
  }
  solveChallenge: solve(type: cloudflare) {
    solved
    challengeToken
  }
  submitButton: click(selector: "#submit") {
    time
  }
  screenshot {
    base64
  }
}
```

### Session Persistence - Reconnect to Puppeteer
```graphql
mutation PersistSession {
  goto(url: "https://example.com", waitUntil: firstMeaningfulPaint) {
    status
  }
  endpoint: reconnect {
    browserWSEndpoint
  }
}
```

Response includes `browserWSEndpoint` to connect with Puppeteer:
```javascript
const endpoint = result.data.endpoint.browserWSEndpoint;
const browser = await puppeteer.connect({ browserWSEndpoint: endpoint });
```

## Troubleshooting

### API Key Errors
- Ensure your API key is valid and active
- Check environment variables are properly set
- Verify you haven't exceeded plan limits

### Timeout Errors
- Increase `timeoutMs` for slow-loading pages
- Use `waitForSelector` to wait for specific elements
- Check network connection and Browserless service status

### Empty Scraping Results
- Verify CSS selectors are correct
- Check if the site requires bot detection bypass (use `browserless_unblock`)
- Try increasing `waitForTimeout` to allow content to load

## Development

### Run in Development Mode
```bash
# HTTP server
npm run dev

# MCP server
npm run dev:mcp
```

### Build TypeScript
```bash
npm run build
```

## Resources

### BrowserQL Documentation
- **Start Guide**: https://docs.browserless.io/browserql/start
- **Schema Reference**: https://docs.browserless.io/bql-schema/schema
- **Language Basics**: https://docs.browserless.io/browserql/writing-bql/language-basics
- **BrowserQL IDE**: https://browserless.io/account/bql-ide
- **Bot Detection**: https://docs.browserless.io/browserql/bot-detection/overview
- **Waiting & Synchronization**: https://docs.browserless.io/browserql/writing-bql/waiting-for-things
- **Form Submission**: https://docs.browserless.io/browserql/use-cases/submitting-forms
- **Session Management**: https://docs.browserless.io/browserql/session-management/persisting-state

### General Resources
- **Browserless Documentation**: https://docs.browserless.io/
- **REST API Reference**: https://docs.browserless.io/rest-apis/intro
- **Dashboard**: https://browserless.io/account/
- **Support**: https://browserless.io/contact
