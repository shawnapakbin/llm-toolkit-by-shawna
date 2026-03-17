#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..", "..");

const servers = {
  terminal: {
    relativeScript: "Terminal/dist/mcp-server.js",
    env: {
      TERMINAL_DEFAULT_TIMEOUT_MS: "60000",
      TERMINAL_MAX_TIMEOUT_MS: "120000",
    },
  },
  "web-browser": {
    relativeScript: "WebBrowser/dist/mcp-server.js",
    env: {
      BROWSER_DEFAULT_TIMEOUT_MS: "20000",
      BROWSER_MAX_TIMEOUT_MS: "60000",
      BROWSER_MAX_CONTENT_CHARS: "12000",
    },
  },
  calculator: {
    relativeScript: "Calculator/dist/mcp-server.js",
    env: {
      CALCULATOR_DEFAULT_PRECISION: "12",
      CALCULATOR_MAX_PRECISION: "20",
    },
  },
  "document-scraper": {
    relativeScript: "DocumentScraper/dist/mcp-server.js",
    env: {
      DOC_SCRAPER_DEFAULT_TIMEOUT_MS: "20000",
      DOC_SCRAPER_MAX_TIMEOUT_MS: "60000",
      DOC_SCRAPER_MAX_CONTENT_BYTES: "52428800",
      DOC_SCRAPER_MAX_CONTENT_CHARS: "50000",
      DOC_SCRAPER_WORKSPACE_ROOT: "",
    },
  },
  clock: {
    relativeScript: "Clock/dist/mcp-server.js",
    env: {
      CLOCK_DEFAULT_TIMEZONE: "",
      CLOCK_DEFAULT_LOCALE: "en-US",
    },
  },
  browserless: {
    relativeScript: "Browserless/dist/mcp-server.js",
    env: {
      BROWSERLESS_API_KEY: "your-browserless-api-token-here",
      BROWSERLESS_DEFAULT_REGION: "production-sfo",
      BROWSERLESS_DEFAULT_TIMEOUT_MS: "30000",
      BROWSERLESS_MAX_TIMEOUT_MS: "120000",
      BROWSERLESS_CONCURRENCY_LIMIT: "5",
    },
  },
};

function normalizeForJson(value) {
  return value.replace(/\\/g, "/");
}

const mcpServers = {};
const missingBuilds = [];

for (const [serverName, serverConfig] of Object.entries(servers)) {
  const fullPath = path.join(repoRoot, serverConfig.relativeScript);
  if (!fs.existsSync(fullPath)) {
    missingBuilds.push(serverConfig.relativeScript);
  }

  mcpServers[serverName] = {
    command: "node",
    args: [normalizeForJson(fullPath)],
    env: serverConfig.env,
  };
}

if (missingBuilds.length > 0) {
  console.error("Warning: some MCP binaries are missing. Run `npm run build` first.");
  for (const missing of missingBuilds) {
    console.error(` - ${missing}`);
  }
  console.error("");
}

process.stdout.write(
  `${JSON.stringify({ mcpServers }, null, "\t")}\n`
);
