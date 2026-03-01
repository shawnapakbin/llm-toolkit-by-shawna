# WebBrowser Tool

Fetches and summarizes web page content for LM Studio. Retrieves HTML content, extracts visible text, and returns metadata (title, URL, content length, fetch time).

## Features

- **HTTP/HTTPS Support**: Fetches any publicly accessible web page
- **Text Extraction**: Removes HTML tags and extracts readable text
- **Content Truncation**: Limits output to prevent token overload
- **Timeout Control**: Configurable timeout (1–60 seconds)
- **Metadata**: Returns title, URL, content length, and fetch duration
- **Error Handling**: Returns detailed error messages for failed requests

## Endpoints

- **GET** `/tool-schema` — Returns the tool schema for LM Studio
- **POST** `/tools/browse_web` — Fetches and extracts content from a URL
- **GET** `/health` — Returns `{"status":"ok"}` for monitoring
- **MCP Server**: `node dist/mcp-server.js` (stdio-based MCP protocol)

**Default Server URL**: `http://localhost:3334`

## Tool Schema

### `browse_web`

Fetches a web page and extracts its visible text content.

#### Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | `string` | **Yes** | — | The full URL to fetch (must start with `http://` or `https://`). |
| `timeoutMs` | `number` | No | `20000` | Timeout in milliseconds (1–60000). Defaults to `BROWSER_DEFAULT_TIMEOUT_MS` env var. If the request takes longer, it will be aborted. |
| `maxContentChars` | `number` | No | `12000` | Maximum number of characters to return from the extracted content. Defaults to `BROWSER_MAX_CONTENT_CHARS` env var. |

#### Response Format

```json
{
  "title": "Example Domain",
  "url": "https://example.com",
  "content": "Example Domain\n\nThis domain is for use in illustrative examples in documents...",
  "contentLength": 150,
  "fetchTimeMs": 342
}
```

| Field | Type | Description |
|-------|------|-------------|
| `title` | `string` | The page title (from `<title>` tag), or `"Untitled"` if missing |
| `url` | `string` | The URL that was fetched (echoed back) |
| `content` | `string` | Extracted visible text (HTML tags removed, truncated to `maxContentChars`) |
| `contentLength` | `number` | Number of characters in the extracted content (before truncation) |
| `fetchTimeMs` | `number` | Time taken to fetch the page (in milliseconds) |

#### Error Response

If the request fails, the response includes an error message:

```json
{
  "error": "Failed to fetch: 404 Not Found",
  "url": "https://example.com/nonexistent"
}
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd WebBrowser
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

**Available Environment Variables**:

```env
BROWSER_PORT=3334
BROWSER_DEFAULT_TIMEOUT_MS=20000
BROWSER_MAX_TIMEOUT_MS=60000
BROWSER_MAX_CONTENT_CHARS=12000
```

| Variable | Default | Description |
|----------|---------|-------------|
| `BROWSER_PORT` | `3334` | HTTP server port |
| `BROWSER_DEFAULT_TIMEOUT_MS` | `20000` | Default timeout (if `timeoutMs` not provided) |
| `BROWSER_MAX_TIMEOUT_MS` | `60000` | Maximum allowed timeout (1–60000 ms) |
| `BROWSER_MAX_CONTENT_CHARS` | `12000` | Maximum characters to return (prevents token overflow) |

### 3. Run the Server

#### HTTP Server (for direct API calls)

```bash
npm run dev
```

The server will start on `http://localhost:3334`.

#### MCP Server (for LM Studio integration)

```bash
npm run build
```

This compiles TypeScript to `dist/mcp-server.js`.

## Example API Calls

### Basic Fetch

```bash
curl -X POST http://localhost:3334/tools/browse_web \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

**Response**:
```json
{
  "title": "Example Domain",
  "url": "https://example.com",
  "content": "Example Domain\n\nThis domain is for use in illustrative examples in documents. You may use this domain in literature without prior coordination or asking for permission.\n\nMore information...",
  "contentLength": 150,
  "fetchTimeMs": 342
}
```

### With Custom Timeout

```bash
curl -X POST http://localhost:3334/tools/browse_web \
  -H "Content-Type: application/json" \
  -d '{"url":"https://slow-site.com","timeoutMs":30000}'
```

### With Content Limit

```bash
curl -X POST http://localhost:3334/tools/browse_web \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","maxContentChars":500}'
```

### Error Example (404)

```bash
curl -X POST http://localhost:3334/tools/browse_web \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/nonexistent"}'
```

**Response**:
```json
{
  "error": "Failed to fetch: 404 Not Found",
  "url": "https://example.com/nonexistent"
}
```

## LM Studio Integration

Add this configuration to your LM Studio `mcp.json`:

```json
{
  "mcpServers": {
    "web-browser": {
      "command": "node",
      "args": ["C:/Users/YOUR_USERNAME/Development/llm-toolkit/WebBrowser/dist/mcp-server.js"],
      "env": {
        "BROWSER_DEFAULT_TIMEOUT_MS": "20000",
        "BROWSER_MAX_TIMEOUT_MS": "60000",
        "BROWSER_MAX_CONTENT_CHARS": "12000"
      }
    }
  }
}
```

**Environment Variables** (optional):
- `BROWSER_DEFAULT_TIMEOUT_MS`: Default timeout (1–60000 ms)
- `BROWSER_MAX_TIMEOUT_MS`: Maximum allowed timeout
- `BROWSER_MAX_CONTENT_CHARS`: Maximum characters to return

## Content Extraction Details

### Text Extraction Process

1. **Fetch HTML**: Uses native `https` or `http` module to fetch the page
2. **Parse HTML**: Extracts text from HTML tags (removes `<script>`, `<style>`, etc.)
3. **Normalize Whitespace**: Collapses multiple spaces/newlines into single spaces
4. **Truncate**: Limits output to `maxContentChars` (default 12,000)

### Removed Elements

- `<script>` tags (JavaScript code)
- `<style>` tags (CSS)
- `<noscript>` tags
- HTML comments (`<!-- ... -->`)
- All HTML attributes (e.g., `class`, `id`, `style`)

### Preserved Elements

- Visible text content
- Line breaks (converted to `\n`)
- Headings, paragraphs, lists, tables (text only)

## Timeout Guidance

| Use Case | Recommended Timeout |
|----------|---------------------|
| **Fast sites** (e.g., `example.com`) | 10,000 ms (10s) |
| **Normal sites** (most websites) | 20,000 ms (20s) |
| **Slow sites** (large pages, slow servers) | 30,000–60,000 ms (30–60s) |
| **API endpoints** | 5,000–10,000 ms (5–10s) |

**Note**: If a request times out, increase `timeoutMs` or check if the site is accessible.

## Common Use Cases

### 1. Research and Summarization

Fetch web pages for LLMs to summarize or answer questions:
```bash
# Fetch a news article
curl -X POST http://localhost:3334/tools/browse_web \
  -d '{"url":"https://news.site.com/article"}'
```

### 2. Documentation Lookup

Fetch technical documentation for code assistance:
```bash
# Fetch API docs
curl -X POST http://localhost:3334/tools/browse_web \
  -d '{"url":"https://docs.example.com/api"}'
```

### 3. Content Monitoring

Check if a page's content has changed:
```bash
# Fetch and compare content
curl -X POST http://localhost:3334/tools/browse_web \
  -d '{"url":"https://example.com","maxContentChars":5000}'
```

### 4. Data Extraction

Extract text from HTML pages for analysis:
```bash
# Fetch and process text
curl -X POST http://localhost:3334/tools/browse_web \
  -d '{"url":"https://wikipedia.org/wiki/Node.js"}'
```

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid URL` | Malformed URL or missing protocol | Ensure URL starts with `http://` or `https://` |
| `Timeout` | Request took too long | Increase `timeoutMs` or check if site is accessible |
| `404 Not Found` | Page doesn't exist | Check URL spelling |
| `403 Forbidden` | Site blocks requests | Some sites block automated requests |
| `500 Internal Server Error` | Site is down or misconfigured | Try again later |
| `SSL error` | Certificate issue | Check if site uses valid HTTPS certificate |

### Error Response Format

All errors return this format:
```json
{
  "error": "Error description",
  "url": "https://example.com"
}
```

## Troubleshooting

| Issue | Diagnosis | Solution |
|-------|-----------|----------|
| `Cannot find module 'node-fetch'` | Dependencies not installed | Run `npm install` |
| `Port 3334 already in use` | Another process is using port 3334 | Change `BROWSER_PORT` in `.env` |
| `Timeout error` | Request too slow | Increase `timeoutMs` or check network connectivity |
| `Empty content` | Page has no visible text | Check if URL is correct and page loads in browser |
| `Content truncated` | Page too large | Increase `maxContentChars` if needed |

## Development Commands

```bash
npm run dev          # Start HTTP server (development mode with auto-reload)
npm run dev:mcp      # Test MCP server (stdio mode)
npm run build        # Compile TypeScript to dist/
npm test             # Run tests (if available)
```

## Implementation Notes

- Uses native Node.js `http`/`https` modules (no external HTTP library)
- HTML parsing uses regex-based text extraction (no DOM parser)
- Content extraction removes all HTML tags and normalizes whitespace
- Timeouts are enforced using `AbortController`
- Redirects (301/302) are followed automatically (up to 5 redirects)
- User-Agent is set to simulate a browser request

## Limitations

- **JavaScript-rendered content**: Only fetches initial HTML (no JavaScript execution)
- **Single-page apps (SPAs)**: May return empty content if page relies on JS
- **Bot detection**: Some sites may block automated requests
- **Authentication**: Does not support login or cookies
- **Binary content**: Only returns text content (images, PDFs, etc. are ignored)

**For advanced browser automation** (JavaScript rendering, screenshots, PDFs), use the **Browserless** tool instead.

## License

MIT
