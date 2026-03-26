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
   BROWSERLESS_API_KEY=
   
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
      "args": ["Browserless/dist/mcp-server.js"],
      "env": {
        "BROWSERLESS_API_KEY": "",
        "BROWSERLESS_DEFAULT_REGION": "production-sfo",
        "BROWSERLESS_DEFAULT_TIMEOUT_MS": "30000",
        "BROWSERLESS_MAX_TIMEOUT_MS": "120000",
        "BROWSERLESS_CONCURRENCY_LIMIT": "5"
      }
    }
  }
}
```

**Tip**: From repo root, run `npm run mcp:print-config` to print a ready-to-paste config with absolute paths for your current folder.

### As HTTP Server

Start the HTTP server:
```bash
npm start
```

The server will run on `http://localhost:3003` (or the port specified in `.env`).

# Browserless MCP Tool

This package provides MCP tool integration for the Browserless API, enabling screenshot, PDF, scraping, content extraction, browser automation, and more via BrowserQL and Puppeteer code.

## Tools

- `browserless_captureScreenshot`: Capture a screenshot of a web page (full page or element). Example: `{ url: 'https://example.com', fullPage: true }`
- `browserless_generatePDF`: Generate a PDF from a web page. Example: `{ url: 'https://example.com', format: 'A4' }`
- `browserless_extractElements`: Extract structured data from a web page using CSS selectors. Example: `{ url: 'https://example.com', elements: [{ selector: 'h1' }] }`
- `browserless_extractContent`: Extract the full HTML and text content from a web page. Example: `{ url: 'https://example.com' }`
- `browserless_bypassProtection`: Bypass bot detection and CAPTCHAs on protected websites. Example: `{ url: 'https://protected.com', content: true, screenshot: true }`
- `browserless_executeBrowserQL`: Execute complex browser automation using BrowserQL (GraphQL-based language). Example: `{ query: 'mutation { click(selector: "#btn") }' }`
- `browserless_executePuppeteerCode`: Execute custom Puppeteer JavaScript code server-side. Example: `{ code: 'await page.goto(\'https://example.com\')' }`
- `browserless_downloadFile`: Download files that Chrome downloads during Puppeteer code execution. Example: `{ code: 'await page.click(\'#download\')' }`
- `browserless_exportContent`: Fetch a URL and stream its native content type (HTML, PDF, images, etc.). Example: `{ url: 'https://example.com', includeResources: true }`
- `browserless_runLighthouseAudit`: Run Lighthouse performance audit on a URL. Example: `{ url: 'https://example.com' }`

## Usage

Each tool requires an API key (set via environment or input). See individual tool descriptions for parameters and examples.

### Example: Capture Screenshot

```
{
  "tool": "browserless_captureScreenshot",
  "params": {
    "url": "https://example.com",
    "fullPage": true
  }
}
```

### Example: Generate PDF

```
{
  "tool": "browserless_generatePDF",
  "params": {
    "url": "https://example.com",
    "format": "A4"
  }
}
```

### Example: Extract Elements

```
{
  "tool": "browserless_extractElements",
  "params": {
    "url": "https://example.com",
    "elements": [{ "selector": "h1" }]
  }
}
```

### Example: Execute BrowserQL

```
{
  "tool": "browserless_executeBrowserQL",
  "params": {
    "query": "mutation { click(selector: \"#btn\") }"
  }
}
```

### Example: Run Lighthouse Audit

```
{
  "tool": "browserless_runLighthouseAudit",
  "params": {
    "url": "https://example.com"
  }
}
```

## Parameters

- All tools accept an optional `apiKey` (string) if not set in the environment.
- `region` (enum): "production-sfo", "production-lon", "production-ams" (optional)
- `timeoutMs` (number): Request timeout in milliseconds (optional)
- See each tool for specific parameters and examples.

## Notes

- For dynamic documentation sites (e.g., kapa.ai), use `browserless_executeBrowserQL` for robust extraction.
- For advanced automation, use `browserless_executePuppeteerCode` with custom JavaScript.

---
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
Extracts full HTML and text content from a page. **For dynamic documentation domains (e.g., browserless-docs.mcp.kapa.ai, docs.browserless.io, kapa.ai), this tool will return explicit guidance to use BrowserQL (`browserless_bql`) for robust content extraction.**

**Parameters:**
- `apiKey` (optional): Browserless API key
- `url` (required): URL to extract content from
- `waitForTimeout` (optional): Wait time before extraction
- `waitForSelector` (optional): Wait for element before extraction
- `region` (optional): Regional endpoint
- `timeoutMs` (optional): Request timeout

**Dynamic Docs Guidance:**
If the URL matches a known dynamic docs domain, the response will include:
- `recommendedTool: "browserless_bql"`
- `guidance`: Example BrowserQL query for robust extraction

**Example (dynamic docs):**
```json
{
  "success": false,
  "error": "Dynamic documentation site detected. Use BrowserQL for robust content extraction.",
  "guidance": "This site requires BrowserQL (browserless_bql) for reliable ingestion. Example: { query: 'query { pageText(url: \"https://browserless-docs.mcp.kapa.ai\") { text } }' }",
  "recommendedTool": "browserless_bql",
  "url": "https://browserless-docs.mcp.kapa.ai"
}
```

**Example (standard site):**
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
3. **MCP configuration**: Set `BROWSERLESS_API_KEY` (or `BROWSERLESS_API_TOKEN`) in the `env` section of `mcp.json`

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

## MCP Cloud Usage (Recommended for LLMs/Agents)

For cloud-based LLM and agent workflows, use the official Browserless MCP endpoint:

- **Endpoint:** `https://mcp.browserless.io/mcp?token=YOUR_TOKEN`
- **Token:** Set `BROWSERLESS_API_TOKEN` or `BROWSERLESS_API_KEY` in your environment (see `.env.example`).
- **No hardcoding:** Never commit your API token to version control.

### Example `.env` for MCP Cloud
```
BROWSERLESS_API_TOKEN=your-browserless-api-token-here
```

### Switching Between Local and Cloud
- **Cloud:** Uses MCP endpoint and API token for authentication.
- **Local:** Uses HTTP server at `http://localhost:3003` (for development/testing only).

### LLM/Agent Integration
- LLMs and agents should use the MCP endpoint for all browser automation tasks.
- Supported operations: screenshots, PDFs, scraping, content extraction, BrowserQL, and more.

### Troubleshooting
- Authentication errors: Check your token and environment variable.
- Protocol errors: Ensure you are using the correct endpoint for your workflow.
- See [Browserless official docs](https://docs.browserless.io/) for more details.

## Troubleshooting

### API Key Errors (HTTP 401)
**Problem**: "HTTP 401: Invalid API key" even with correct API key

**Solution**:
- Ensure your API key is valid and active (get from https://browserless.io/account/)
- Verify API key is set in ONE of:
  - `BROWSERLESS_API_KEY` environment variable
  - `BROWSERLESS_API_TOKEN` environment variable
  - `apiKey` parameter in the tool call
- Check that you haven't exceeded your plan's daily limits
- Verify the key is being passed correctly and hasn't expired

**Important for LLMs**: Request parameters should be **flat** (not nested). For example:
```json
// ✅ CORRECT
{
  "url": "https://example.com",
  "fullPage": true,
  "type": "png",
  "waitForTimeout": 5000
}

// ❌ INCORRECT
{
  "url": "https://example.com",
  "options": {
    "fullPage": true,
    "type": "png"
  }
}
```

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
