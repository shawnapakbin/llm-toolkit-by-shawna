import dotenv from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  takeScreenshot,
  generatePDF,
  scrapePage,
  getContent,
  unblockPage,
  executeBQL,
  executeFunction,
  downloadFile,
  exportPage,
  performanceLighthouse,
  type BrowserlessConfig,
} from "./browserless";

dotenv.config();

// Get API key from environment - REQUIRED
const BROWSERLESS_API_KEY = process.env.BROWSERLESS_API_KEY || "";
const DEFAULT_REGION = (process.env.BROWSERLESS_DEFAULT_REGION as any) || "production-sfo";
const DEFAULT_TIMEOUT_MS = Number(process.env.BROWSERLESS_DEFAULT_TIMEOUT_MS ?? 30000);
const MAX_TIMEOUT_MS = Number(process.env.BROWSERLESS_MAX_TIMEOUT_MS ?? 120000);
const CONCURRENCY_LIMIT = Number(process.env.BROWSERLESS_CONCURRENCY_LIMIT ?? 5);

const server = new McpServer({
  name: "lm-studio-browserless-tool",
  version: "1.0.0",
});

// Concurrency queue system
let activeRequests = 0;
const requestQueue: Array<() => Promise<any>> = [];

async function executeWithConcurrencyLimit<T>(
  fn: () => Promise<T>
): Promise<T> {
  while (activeRequests >= CONCURRENCY_LIMIT) {
    // Wait 50ms before checking again
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  activeRequests++;
  try {
    return await fn();
  } finally {
    activeRequests--;
  }
}

// Helper function to get config with optional API key override
function getConfig(apiKey?: string, region?: string, timeoutMs?: number): BrowserlessConfig {
  const effectiveApiKey = apiKey || BROWSERLESS_API_KEY;
  
  if (!effectiveApiKey) {
    throw new Error("Browserless API key is required. Provide via BROWSERLESS_API_KEY environment variable or apiKey parameter.");
  }

  return {
    apiKey: effectiveApiKey,
    region: region as any || DEFAULT_REGION,
    timeoutMs: timeoutMs || DEFAULT_TIMEOUT_MS,
  };
}

// Screenshot tool
server.registerTool(
  "browserless_screenshot",
  {
    description: "Captures a screenshot of a web page using Browserless API. Supports full page, specific selectors, and various image formats. Requires API key.",
    inputSchema: {
      apiKey: z.string().optional().describe("Browserless API key (optional if set in environment)"),
      url: z.string().url().describe("The URL of the web page to screenshot"),
      fullPage: z.boolean().optional().describe("Capture the full scrollable page (default: false)"),
      type: z.enum(["png", "jpeg", "webp"]).optional().describe("Image format (default: png)"),
      quality: z.number().int().min(0).max(100).optional().describe("Image quality 0-100 for jpeg/webp"),
      selector: z.string().optional().describe("CSS selector to screenshot a specific element"),
      waitForTimeout: z.number().int().positive().optional().describe("Wait time in ms before screenshot"),
      waitForSelector: z.string().optional().describe("CSS selector to wait for before screenshot"),
      region: z.enum(["production-sfo", "production-lon", "production-ams"]).optional().describe("Browserless region"),
      timeoutMs: z.number().int().positive().optional().describe("Request timeout in milliseconds"),
    } as any,
  },
  async (params: any): Promise<CallToolResult> => {
    return executeWithConcurrencyLimit(async () => {
      try {
        const config = getConfig(params.apiKey, params.region, params.timeoutMs);
        const result = await takeScreenshot(config, {
          url: params.url,
          fullPage: params.fullPage,
          type: params.type,
          quality: params.quality,
          selector: params.selector,
          waitForTimeout: params.waitForTimeout,
          waitForSelector: params.waitForSelector,
        });

        return {
          isError: !result.success,
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify({ success: false, error: error.message }, null, 2) }],
        };
      }
    });
  }
);

// PDF generation tool
server.registerTool(
  "browserless_pdf",
  {
    description: "Generates a PDF from a web page using Browserless API. Supports various page formats and options.",
    inputSchema: {
      apiKey: z.string().optional().describe("Browserless API key (optional if set in environment)"),
      url: z.string().url().describe("The URL of the web page to convert to PDF"),
      format: z.enum(["Letter", "Legal", "Tabloid", "Ledger", "A0", "A1", "A2", "A3", "A4", "A5", "A6"]).optional().describe("Page format (default: A4)"),
      landscape: z.boolean().optional().describe("Use landscape orientation (default: false)"),
      printBackground: z.boolean().optional().describe("Print background graphics (default: true)"),
      scale: z.number().min(0.1).max(2).optional().describe("Scale of webpage rendering (0.1-2, default: 1)"),
      waitForTimeout: z.number().int().positive().optional().describe("Wait time in ms before generating PDF"),
      waitForSelector: z.string().optional().describe("CSS selector to wait for before generating PDF"),
      region: z.enum(["production-sfo", "production-lon", "production-ams"]).optional().describe("Browserless region"),
      timeoutMs: z.number().int().positive().optional().describe("Request timeout in milliseconds"),
    } as any,
  },
  async (params: any): Promise<CallToolResult> => {
    return executeWithConcurrencyLimit(async () => {
      try {
        const config = getConfig(params.apiKey, params.region, params.timeoutMs);
        const result = await generatePDF(config, {
          url: params.url,
          format: params.format,
          landscape: params.landscape,
          printBackground: params.printBackground,
          scale: params.scale,
          waitForTimeout: params.waitForTimeout,
          waitForSelector: params.waitForSelector,
        });

        return {
          isError: !result.success,
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify({ success: false, error: error.message }, null, 2) }],
        };
      }
    });
  }
);

// Scrape tool
server.registerTool(
  "browserless_scrape",
  {
    description: "Extracts structured data from a web page using CSS selectors via Browserless API. Returns text, HTML, and attributes of matching elements.",
    inputSchema: {
      apiKey: z.string().optional().describe("Browserless API key (optional if set in environment)"),
      url: z.string().url().describe("The URL of the web page to scrape"),
      elements: z.array(z.object({
        selector: z.string().describe("CSS selector for elements to extract"),
        timeout: z.number().int().positive().optional().describe("Timeout for this selector in ms"),
      })).min(1).describe("Array of element selectors to extract"),
      waitForTimeout: z.number().int().positive().optional().describe("Wait time in ms before scraping"),
      waitForSelector: z.string().optional().describe("CSS selector to wait for before scraping"),
      region: z.enum(["production-sfo", "production-lon", "production-ams"]).optional().describe("Browserless region"),
      timeoutMs: z.number().int().positive().optional().describe("Request timeout in milliseconds"),
    } as any,
  },
  async (params: any): Promise<CallToolResult> => {
    return executeWithConcurrencyLimit(async () => {
      try {
        const config = getConfig(params.apiKey, params.region, params.timeoutMs);
        const result = await scrapePage(config, {
          url: params.url,
          elements: params.elements,
          waitForTimeout: params.waitForTimeout,
          waitForSelector: params.waitForSelector,
        });

        return {
          isError: !result.success,
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify({ success: false, error: error.message }, null, 2) }],
        };
      }
    });
  }
);

// Content extraction tool
server.registerTool(
  "browserless_content",
  {
    description: "Extracts the full HTML and text content from a web page using Browserless API. Useful for getting all page content.",
    inputSchema: {
      apiKey: z.string().optional().describe("Browserless API key (optional if set in environment)"),
      url: z.string().url().describe("The URL of the web page to extract content from"),
      waitForTimeout: z.number().int().positive().optional().describe("Wait time in ms before extracting content"),
      waitForSelector: z.string().optional().describe("CSS selector to wait for before extracting content"),
      region: z.enum(["production-sfo", "production-lon", "production-ams"]).optional().describe("Browserless region"),
      timeoutMs: z.number().int().positive().optional().describe("Request timeout in milliseconds"),
    } as any,
  },
  async (params: any): Promise<CallToolResult> => {
    return executeWithConcurrencyLimit(async () => {
      try {
        const config = getConfig(params.apiKey, params.region, params.timeoutMs);
        const result = await getContent(config, {
          url: params.url,
          waitForTimeout: params.waitForTimeout,
          waitForSelector: params.waitForSelector,
        });

        return {
          isError: !result.success,
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify({ success: false, error: error.message }, null, 2) }],
        };
      }
    });
  }
);

// Unblock tool
server.registerTool(
  "browserless_unblock",
  {
    description: "Bypasses bot detection and CAPTCHAs on protected websites using Browserless API. Can return content, cookies, screenshot, and WebSocket endpoint for further automation.",
    inputSchema: {
      apiKey: z.string().optional().describe("Browserless API key (optional if set in environment)"),
      url: z.string().url().describe("The URL of the protected web page to unblock"),
      cookies: z.boolean().optional().describe("Return cookies after unblocking (default: false)"),
      content: z.boolean().optional().describe("Return page content after unblocking (default: false)"),
      screenshot: z.boolean().optional().describe("Return screenshot after unblocking (default: false)"),
      browserWSEndpoint: z.boolean().optional().describe("Return WebSocket endpoint for Puppeteer/Playwright connection (default: false)"),
      region: z.enum(["production-sfo", "production-lon", "production-ams"]).optional().describe("Browserless region"),
      timeoutMs: z.number().int().positive().optional().describe("Request timeout in milliseconds"),
    } as any,
  },
  async (params: any): Promise<CallToolResult> => {
    return executeWithConcurrencyLimit(async () => {
      try {
        const config = getConfig(params.apiKey, params.region, params.timeoutMs);
        const result = await unblockPage(config, {
          url: params.url,
          cookies: params.cookies,
          content: params.content,
          screenshot: params.screenshot,
          browserWSEndpoint: params.browserWSEndpoint,
        });

        return {
          isError: !result.success,
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify({ success: false, error: error.message }, null, 2) }],
        };
      }
    });
  }
);

// BQL (Browser Query Language) tool
server.registerTool(
  "browserless_bql",
  {
    description: "Executes complex browser automation using BrowserQL (GraphQL-based language). Supports: navigation (goto), interaction (click/type), form filling, CAPTCHA solving, data extraction (text/html), screenshots, session persistence, stealth/bot-detection evasion, waiting/sync (waitForNavigation/Request/Response/Selector/Timeout), and hybrid automation with reconnect. See: https://docs.browserless.io/browserql/start and https://docs.browserless.io/bql-schema/schema. Sessions are recorded by default (replay=true) for debugging.",
    inputSchema: {
      apiKey: z.string().optional().describe("Browserless API key (optional if set in environment)"),
      query: z.string().min(1).describe("BrowserQL GraphQL mutation query. See docs: https://docs.browserless.io/bql-schema/schema"),
      variables: z.record(z.any()).optional().describe("GraphQL variables for the query"),
      operationName: z.string().optional().describe("Name of the GraphQL operation to execute"),
      region: z.enum(["production-sfo", "production-lon", "production-ams"]).optional().describe("Browserless region"),
      timeoutMs: z.number().int().positive().optional().describe("Request timeout in milliseconds"),
    } as any,
  },
  async (params: any): Promise<CallToolResult> => {
    return executeWithConcurrencyLimit(async () => {
      try {
        const config = getConfig(params.apiKey, params.region, params.timeoutMs);
        const result = await executeBQL(config, {
          query: params.query,
          variables: params.variables,
          operationName: params.operationName,
          replay: true,
        });

        return {
          isError: !result.success,
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify({ success: false, error: error.message }, null, 2) }],
        };
      }
    });
  }
);

// Execute custom Puppeteer code server-side
server.registerTool(
  "browserless_function",
  {
    description: "Executes custom Puppeteer code server-side. Useful for complex automation that doesn't fit standard REST APIs. Code runs in a browser context with access to Puppeteer API.",
    inputSchema: {
      apiKey: z.string().optional().describe("Browserless API key (optional if set in environment)"),
      code: z.string().min(1).describe("JavaScript/Puppeteer code to execute"),
      context: z.record(z.any()).optional().describe("Context object passed to the code"),
      region: z.enum(["production-sfo", "production-lon", "production-ams"]).optional().describe("Browserless region"),
      timeoutMs: z.number().int().positive().optional().describe("Request timeout in milliseconds"),
    } as any,
  },
  async (params: any): Promise<CallToolResult> => {
    return executeWithConcurrencyLimit(async () => {
      try {
        const config = getConfig(params.apiKey, params.region, params.timeoutMs);
        const result = await executeFunction(config, {
          code: params.code,
          context: params.context,
          timeout: params.timeoutMs,
        });

        return {
          isError: !result.success,
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify({ success: false, error: error.message }, null, 2) }],
        };
      }
    });
  }
);

// Download files that Chrome downloads during execution
server.registerTool(
  "browserless_download",
  {
    description: "Downloads files that Chrome downloads during Puppeteer code execution. Returns file as base64-encoded data.",
    inputSchema: {
      apiKey: z.string().optional().describe("Browserless API key (optional if set in environment)"),
      code: z.string().min(1).describe("Puppeteer code that triggers file download"),
      context: z.record(z.any()).optional().describe("Context object passed to the code"),
      region: z.enum(["production-sfo", "production-lon", "production-ams"]).optional().describe("Browserless region"),
      timeoutMs: z.number().int().positive().optional().describe("Request timeout in milliseconds"),
    } as any,
  },
  async (params: any): Promise<CallToolResult> => {
    return executeWithConcurrencyLimit(async () => {
      try {
        const config = getConfig(params.apiKey, params.region, params.timeoutMs);
        const result = await downloadFile(config, {
          code: params.code,
          context: params.context,
          timeout: params.timeoutMs,
        });

        return {
          isError: !result.success,
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify({ success: false, error: error.message }, null, 2) }],
        };
      }
    });
  }
);

// Export/fetch URL and stream its content
server.registerTool(
  "browserless_export",
  {
    description: "Fetches a URL and streams its native content type (HTML, PDF, images, etc.). Optionally bundles all resources as a ZIP file.",
    inputSchema: {
      apiKey: z.string().optional().describe("Browserless API key (optional if set in environment)"),
      url: z.string().url().describe("URL to fetch and export"),
      includeResources: z.boolean().optional().describe("If true, includes all resources as a ZIP bundle"),
      region: z.enum(["production-sfo", "production-lon", "production-ams"]).optional().describe("Browserless region"),
      timeoutMs: z.number().int().positive().optional().describe("Request timeout in milliseconds"),
    } as any,
  },
  async (params: any): Promise<CallToolResult> => {
    return executeWithConcurrencyLimit(async () => {
      try {
        const config = getConfig(params.apiKey, params.region, params.timeoutMs);
        const result = await exportPage(config, {
          url: params.url,
          includeResources: params.includeResources ?? false,
          timeout: params.timeoutMs,
        });

        return {
          isError: !result.success,
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify({ success: false, error: error.message }, null, 2) }],
        };
      }
    });
  }
);

// Lighthouse performance audit
server.registerTool(
  "browserless_performance",
  {
    description: "Runs Lighthouse performance audits on a URL. Returns SEO, accessibility, best practices, and performance scores along with detailed metrics.",
    inputSchema: {
      apiKey: z.string().optional().describe("Browserless API key (optional if set in environment)"),
      url: z.string().url().describe("URL to audit"),
      config: z.record(z.any()).optional().describe("Lighthouse configuration options"),
      region: z.enum(["production-sfo", "production-lon", "production-ams"]).optional().describe("Browserless region"),
      timeoutMs: z.number().int().positive().optional().describe("Request timeout in milliseconds"),
    } as any,
  },
  async (params: any): Promise<CallToolResult> => {
    return executeWithConcurrencyLimit(async () => {
      try {
        const config = getConfig(params.apiKey, params.region, params.timeoutMs);
        const result = await performanceLighthouse(config, {
          url: params.url,
          config: params.config,
          timeout: params.timeoutMs,
        });

        return {
          isError: !result.success,
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify({ success: false, error: error.message }, null, 2) }],
        };
      }
    });
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LM Studio Browserless MCP server running on stdio");
  
  if (!BROWSERLESS_API_KEY) {
    console.error("WARNING: BROWSERLESS_API_KEY not set in environment. API key must be provided with each request.");
  }
}

main().catch((error) => {
  console.error("MCP server startup failed:", error);
  process.exit(1);
});
