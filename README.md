# LM Studio Tools

This workspace contains local tools for LM Studio.

See implementation roadmap: [AGENT_ROADMAP.md](AGENT_ROADMAP.md)

## Tools
- [Terminal](Terminal/README.md): Execute local terminal commands via HTTP tool endpoint and MCP server. ✅ **Auto-detects Windows/macOS/Linux and provides OS-specific commands.**
- [WebBrowser](WebBrowser/README.md): Fetch web pages and return readable text via HTTP tool endpoint and MCP server.
- [Calculator](Calculator/README.md): Evaluate engineering/math expressions via HTTP tool endpoint and MCP server.
- [Clock](Clock/README.md): Provide realtime date/time/calendar/timezone details via HTTP tool endpoint and MCP server.
- [Browserless](Browserless/README.md): Advanced browser automation with Browserless.io REST APIs and BrowserQL. 10 tools: screenshot, PDF, scraping, content, unblock, BQL, function execution, file download, export, and Lighthouse performance audits.

## Complete `mcp.json` Example

```json
{
	"mcpServers": {
		"terminal": {
			"command": "node",
			"args": ["C:/Users/YOUR_USERNAME/Development/llm-toolkit/Terminal/dist/mcp-server.js"],
			"env": {
				"TERMINAL_DEFAULT_TIMEOUT_MS": "60000",
				"TERMINAL_MAX_TIMEOUT_MS": "120000"
			}
		},
		"web-browser": {
			"command": "node",
			"args": ["C:/Users/YOUR_USERNAME/Development/llm-toolkit/WebBrowser/dist/mcp-server.js"],
			"env": {
				"BROWSER_DEFAULT_TIMEOUT_MS": "20000",
				"BROWSER_MAX_TIMEOUT_MS": "60000",
				"BROWSER_MAX_CONTENT_CHARS": "12000"
			}
		},
		"calculator": {
			"command": "node",
			"args": ["C:/Users/YOUR_USERNAME/Development/llm-toolkit/Calculator/dist/mcp-server.js"],
			"env": {
				"CALCULATOR_DEFAULT_PRECISION": "12",
				"CALCULATOR_MAX_PRECISION": "20"
			}
		},
		"clock": {
			"command": "node",
			"args": ["C:/Users/YOUR_USERNAME/Development/llm-toolkit/Clock/dist/mcp-server.js"],
			"env": {
				"CLOCK_DEFAULT_TIMEZONE": "",
				"CLOCK_DEFAULT_LOCALE": "en-US"
			}
		},
		"browserless": {
			"command": "node",
			"args": ["C:/Users/YOUR_USERNAME/Development/llm-toolkit/Browserless/dist/mcp-server.js"],
			"env": {
				"BROWSERLESS_API_KEY": "your-browserless-api-token-here",
				"BROWSERLESS_DEFAULT_REGION": "production-sfo",
				"BROWSERLESS_DEFAULT_TIMEOUT_MS": "30000",
				"BROWSERLESS_MAX_TIMEOUT_MS": "120000",
				"BROWSERLESS_CONCURRENCY_LIMIT": "5"
			}
		}
	}
}
```

**Note**: Update paths to match your installation directory.
