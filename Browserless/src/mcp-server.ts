import path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import { z } from "zod";
import {
  type BrowserlessConfig,
  downloadFile,
  executeBQL,
  executeFunction,
  exportPage,
  generatePDF,
  getContent,
  performanceLighthouse,
  scrapePage,
  takeScreenshot,
  unblockPage,
} from "./browserless";

// Load .env from the tool root regardless of launch cwd, then merge process env.
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

const DEFAULT_REGION = process.env.BROWSERLESS_DEFAULT_REGION || "production-sfo";
const DEFAULT_TIMEOUT_MS = Number(process.env.BROWSERLESS_DEFAULT_TIMEOUT_MS ?? 30000);
const MAX_TIMEOUT_MS = Number(process.env.BROWSERLESS_MAX_TIMEOUT_MS ?? 120000);
const CONCURRENCY_LIMIT = Number(process.env.BROWSERLESS_CONCURRENCY_LIMIT ?? 5);

const server = new McpServer({
  name: "lm-studio-browserless-tool",
  version: "1.0.0",
});

const registerToolLoose = server.registerTool as unknown as (
  name: string,
  config: { description: string; inputSchema: Record<string, z.ZodTypeAny> },
  handler: (params: unknown) => Promise<CallToolResult>,
) => void;

// Concurrency queue system
let activeRequests = 0;

async function executeWithConcurrencyLimit<T>(fn: () => Promise<T>): Promise<T> {
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
  const fromInput = apiKey?.trim();
  const fromEnv = process.env.BROWSERLESS_API_KEY?.trim();
  // Alias supports MCP env blocks that may use a token naming convention.
  const fromEnvAlias = process.env.BROWSERLESS_API_TOKEN?.trim();
  const effectiveApiKey = fromInput || fromEnv || fromEnvAlias || "";

  if (!effectiveApiKey) {
    throw new Error(
      "Browserless API key is required. Provide apiKey in tool input, BROWSERLESS_API_KEY in .env, or BROWSERLESS_API_KEY/BROWSERLESS_API_TOKEN in mcp.json env.",
    );
  }

  const requestedTimeout = Number(timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const boundedTimeout = Math.min(Math.max(requestedTimeout, 1), MAX_TIMEOUT_MS);

  return {
    apiKey: effectiveApiKey,
    region: (region || DEFAULT_REGION) as BrowserlessConfig["region"],
    timeoutMs: boundedTimeout,
  };
}

function hasConfiguredApiKey(): boolean {
  return Boolean(
    process.env.BROWSERLESS_API_KEY?.trim() || process.env.BROWSERLESS_API_TOKEN?.trim(),
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Screenshot tool
registerToolLoose(
  "browserless_captureScreenshot",
  {
    description:
      "Capture a screenshot of a web page (full page or element) using Browserless API. Supports PNG, JPEG, WEBP. Example: { url: 'https://example.com', fullPage: true }.",
    inputSchema: {
      apiKey: z
        .string()
        .optional()
        .describe("Browserless API key (optional if set in environment)"),
      url: z.string().url().describe("The URL of the web page to screenshot"),
      fullPage: z
        .boolean()
        .optional()
        .describe("Capture the full scrollable page (default: false)"),
      type: z.enum(["png", "jpeg", "webp"]).optional().describe("Image format (default: png)"),
      quality: z
        .number()
        .int()
        .min(0)
        .max(100)
        .optional()
        .describe("Image quality 0-100 for jpeg/webp"),
      selector: z.string().optional().describe("CSS selector to screenshot a specific element"),
      waitForTimeout: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Wait time in ms before screenshot"),
      waitForSelector: z.string().optional().describe("CSS selector to wait for before screenshot"),
      region: z
        .enum(["production-sfo", "production-lon", "production-ams"])
        .optional()
        .describe("Browserless region"),
      timeoutMs: z.number().int().positive().optional().describe("Request timeout in milliseconds"),
    },
  },
  async (rawParams): Promise<CallToolResult> => {
    const params = rawParams as {
      apiKey?: string;
      url: string;
      fullPage?: boolean;
      type?: "png" | "jpeg" | "webp";
      quality?: number;
      selector?: string;
      waitForTimeout?: number;
      waitForSelector?: string;
      region?: BrowserlessConfig["region"];
      timeoutMs?: number;
    };
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
      } catch (error: unknown) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: false, error: getErrorMessage(error) }, null, 2),
            },
          ],
        };
      }
    });
  },
);

// PDF generation tool
registerToolLoose(
  "browserless_generatePDF",
  {
    description:
      "Generate a PDF from a web page using Browserless API. Supports page format, orientation, and scale. Example: { url: 'https://example.com', format: 'A4' }.",
    inputSchema: {
      apiKey: z
        .string()
        .optional()
        .describe("Browserless API key (optional if set in environment)"),
      url: z.string().url().describe("The URL of the web page to convert to PDF"),
      format: z
        .enum(["Letter", "Legal", "Tabloid", "Ledger", "A0", "A1", "A2", "A3", "A4", "A5", "A6"])
        .optional()
        .describe("Page format (default: A4)"),
      landscape: z.boolean().optional().describe("Use landscape orientation (default: false)"),
      printBackground: z.boolean().optional().describe("Print background graphics (default: true)"),
      scale: z
        .number()
        .min(0.1)
        .max(2)
        .optional()
        .describe("Scale of webpage rendering (0.1-2, default: 1)"),
      waitForTimeout: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Wait time in ms before generating PDF"),
      waitForSelector: z
        .string()
        .optional()
        .describe("CSS selector to wait for before generating PDF"),
      region: z
        .enum(["production-sfo", "production-lon", "production-ams"])
        .optional()
        .describe("Browserless region"),
      timeoutMs: z.number().int().positive().optional().describe("Request timeout in milliseconds"),
    },
  },
  async (rawParams): Promise<CallToolResult> => {
    const params = rawParams as {
      apiKey?: string;
      url: string;
      format?:
        | "Letter"
        | "Legal"
        | "Tabloid"
        | "Ledger"
        | "A0"
        | "A1"
        | "A2"
        | "A3"
        | "A4"
        | "A5"
        | "A6";
      landscape?: boolean;
      printBackground?: boolean;
      scale?: number;
      waitForTimeout?: number;
      waitForSelector?: string;
      region?: BrowserlessConfig["region"];
      timeoutMs?: number;
    };
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
      } catch (error: unknown) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: false, error: getErrorMessage(error) }, null, 2),
            },
          ],
        };
      }
    });
  },
);

// Scrape tool
registerToolLoose(
  "browserless_extractElements",
  {
    description:
      "Extract structured data from a web page using CSS selectors. Returns text, HTML, and attributes. Example: { url: 'https://example.com', elements: [{ selector: 'h1' }] }.",
    inputSchema: {
      apiKey: z
        .string()
        .optional()
        .describe("Browserless API key (optional if set in environment)"),
      url: z.string().url().describe("The URL of the web page to scrape"),
      elements: z
        .array(
          z.object({
            selector: z.string().describe("CSS selector for elements to extract"),
            timeout: z
              .number()
              .int()
              .positive()
              .optional()
              .describe("Timeout for this selector in ms"),
          }),
        )
        .min(1)
        .describe("Array of element selectors to extract"),
      waitForTimeout: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Wait time in ms before scraping"),
      waitForSelector: z.string().optional().describe("CSS selector to wait for before scraping"),
      region: z
        .enum(["production-sfo", "production-lon", "production-ams"])
        .optional()
        .describe("Browserless region"),
      timeoutMs: z.number().int().positive().optional().describe("Request timeout in milliseconds"),
    },
  },
  async (rawParams): Promise<CallToolResult> => {
    const params = rawParams as {
      apiKey?: string;
      url: string;
      elements: Array<{ selector: string; timeout?: number }>;
      waitForTimeout?: number;
      waitForSelector?: string;
      region?: BrowserlessConfig["region"];
      timeoutMs?: number;
    };
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
      } catch (error: unknown) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: false, error: getErrorMessage(error) }, null, 2),
            },
          ],
        };
      }
    });
  },
);

// Content extraction tool
registerToolLoose(
  "browserless_extractContent",
  {
    description:
      "Extract the full HTML and text content from a web page. Use for general content extraction. Example: { url: 'https://example.com' }.",
    inputSchema: {
      apiKey: z
        .string()
        .optional()
        .describe("Browserless API key (optional if set in environment)"),
      url: z.string().url().describe("The URL of the web page to extract content from"),
      waitForTimeout: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Wait time in ms before extracting content"),
      waitForSelector: z
        .string()
        .optional()
        .describe("CSS selector to wait for before extracting content"),
      region: z
        .enum(["production-sfo", "production-lon", "production-ams"])
        .optional()
        .describe("Browserless region"),
      timeoutMs: z.number().int().positive().optional().describe("Request timeout in milliseconds"),
    },
  },
  async (rawParams): Promise<CallToolResult> => {
    const params = rawParams as {
      apiKey?: string;
      url: string;
      waitForTimeout?: number;
      waitForSelector?: string;
      region?: BrowserlessConfig["region"];
      timeoutMs?: number;
    };
    // BrowserQL guidance for dynamic docs domains
    const dynamicDomains = [
      "browserless-docs.mcp.kapa.ai",
      "docs.browserless.io",
      "kapa.ai",
    ];
    const urlHost = (() => {
      try {
        return new URL(params.url).host;
      } catch {
        return "";
      }
    })();
    if (dynamicDomains.some((d) => urlHost.endsWith(d))) {
      return {
        isError: false,
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: "Dynamic documentation site detected. Use BrowserQL for robust content extraction.",
              guidance: "This site requires BrowserQL (browserless_bql) for reliable ingestion. Example: { query: 'query { pageText(url: \"' + params.url + '\") { text } }' }",
              recommendedTool: "browserless_bql",
              url: params.url,
            }, null, 2),
          },
        ],
      };
    }
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
      } catch (error: unknown) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: false, error: getErrorMessage(error) }, null, 2),
            },
          ],
        };
      }
    });
  },
);

// Unblock tool
registerToolLoose(
  "browserless_bypassProtection",
  {
    description:
      "Bypass bot detection and CAPTCHAs on protected websites. Can return content, cookies, screenshot, and WebSocket endpoint. Example: { url: 'https://protected.com', content: true, screenshot: true }.",
    inputSchema: {
      apiKey: z
        .string()
        .optional()
        .describe("Browserless API key (optional if set in environment)"),
      url: z.string().url().describe("The URL of the protected web page to unblock"),
      cookies: z.boolean().optional().describe("Return cookies after unblocking (default: false)"),
      content: z
        .boolean()
        .optional()
        .describe("Return page content after unblocking (default: false)"),
      screenshot: z
        .boolean()
        .optional()
        .describe("Return screenshot after unblocking (default: false)"),
      browserWSEndpoint: z
        .boolean()
        .optional()
        .describe("Return WebSocket endpoint for Puppeteer/Playwright connection (default: false)"),
      region: z
        .enum(["production-sfo", "production-lon", "production-ams"])
        .optional()
        .describe("Browserless region"),
      timeoutMs: z.number().int().positive().optional().describe("Request timeout in milliseconds"),
    },
  },
  async (rawParams): Promise<CallToolResult> => {
    const params = rawParams as {
      apiKey?: string;
      url: string;
      cookies?: boolean;
      content?: boolean;
      screenshot?: boolean;
      browserWSEndpoint?: boolean;
      region?: BrowserlessConfig["region"];
      timeoutMs?: number;
    };
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
      } catch (error: unknown) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: false, error: getErrorMessage(error) }, null, 2),
            },
          ],
        };
      }
    });
  },
);

// BQL (Browser Query Language) tool
registerToolLoose(
  "browserless_executeBrowserQL",
  {
    description:
      "Execute complex browser automation using BrowserQL (GraphQL-based language). Supports navigation, interaction, extraction, CAPTCHA solving, and more. Example: { query: 'mutation { click(selector: \"#btn\") }' }.",
    inputSchema: {
      apiKey: z
        .string()
        .optional()
        .describe("Browserless API key (optional if set in environment)"),
      query: z
        .string()
        .min(1)
        .describe(
          "BrowserQL GraphQL mutation query. See docs: https://docs.browserless.io/bql-schema/schema",
        ),
      variables: z.record(z.unknown()).optional().describe("GraphQL variables for the query"),
      operationName: z.string().optional().describe("Name of the GraphQL operation to execute"),
      region: z
        .enum(["production-sfo", "production-lon", "production-ams"])
        .optional()
        .describe("Browserless region"),
      timeoutMs: z.number().int().positive().optional().describe("Request timeout in milliseconds"),
    },
  },
  async (rawParams): Promise<CallToolResult> => {
    const params = rawParams as {
      apiKey?: string;
      query: string;
      variables?: Record<string, unknown>;
      operationName?: string;
      region?: BrowserlessConfig["region"];
      timeoutMs?: number;
    };
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
      } catch (error: unknown) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: false, error: getErrorMessage(error) }, null, 2),
            },
          ],
        };
      }
    });
  },
);

// Execute custom Puppeteer code server-side
registerToolLoose(
  "browserless_executePuppeteerCode",
  {
    description:
      "Execute custom Puppeteer JavaScript code server-side. Useful for advanced automation. Example: { code: 'await page.goto(\'https://example.com\')' }.",
    inputSchema: {
      apiKey: z
        .string()
        .optional()
        .describe("Browserless API key (optional if set in environment)"),
      code: z.string().min(1).describe("JavaScript/Puppeteer code to execute"),
      context: z.record(z.unknown()).optional().describe("Context object passed to the code"),
      region: z
        .enum(["production-sfo", "production-lon", "production-ams"])
        .optional()
        .describe("Browserless region"),
      timeoutMs: z.number().int().positive().optional().describe("Request timeout in milliseconds"),
    },
  },
  async (rawParams): Promise<CallToolResult> => {
    const params = rawParams as {
      apiKey?: string;
      code: string;
      context?: Record<string, unknown>;
      region?: BrowserlessConfig["region"];
      timeoutMs?: number;
    };
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
      } catch (error: unknown) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: false, error: getErrorMessage(error) }, null, 2),
            },
          ],
        };
      }
    });
  },
);

// Download files that Chrome downloads during execution
registerToolLoose(
  "browserless_downloadFile",
  {
    description:
      "Download files that Chrome downloads during Puppeteer code execution. Returns file as base64. Example: { code: 'await page.click(\'#download\')' }.",
    inputSchema: {
      apiKey: z
        .string()
        .optional()
        .describe("Browserless API key (optional if set in environment)"),
      code: z.string().min(1).describe("Puppeteer code that triggers file download"),
      context: z.record(z.unknown()).optional().describe("Context object passed to the code"),
      region: z
        .enum(["production-sfo", "production-lon", "production-ams"])
        .optional()
        .describe("Browserless region"),
      timeoutMs: z.number().int().positive().optional().describe("Request timeout in milliseconds"),
    },
  },
  async (rawParams): Promise<CallToolResult> => {
    const params = rawParams as {
      apiKey?: string;
      code: string;
      context?: Record<string, unknown>;
      region?: BrowserlessConfig["region"];
      timeoutMs?: number;
    };
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
      } catch (error: unknown) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: false, error: getErrorMessage(error) }, null, 2),
            },
          ],
        };
      }
    });
  },
);

// Export/fetch URL and stream its content
registerToolLoose(
  "browserless_exportContent",
  {
    description:
      "Fetch a URL and stream its native content type (HTML, PDF, images, etc.). Optionally bundle all resources as ZIP. Example: { url: 'https://example.com', includeResources: true }.",
    inputSchema: {
      apiKey: z
        .string()
        .optional()
        .describe("Browserless API key (optional if set in environment)"),
      url: z.string().url().describe("URL to fetch and export"),
      includeResources: z
        .boolean()
        .optional()
        .describe("If true, includes all resources as a ZIP bundle"),
      region: z
        .enum(["production-sfo", "production-lon", "production-ams"])
        .optional()
        .describe("Browserless region"),
      timeoutMs: z.number().int().positive().optional().describe("Request timeout in milliseconds"),
    },
  },
  async (rawParams): Promise<CallToolResult> => {
    const params = rawParams as {
      apiKey?: string;
      url: string;
      includeResources?: boolean;
      region?: BrowserlessConfig["region"];
      timeoutMs?: number;
    };
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
      } catch (error: unknown) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: false, error: getErrorMessage(error) }, null, 2),
            },
          ],
        };
      }
    });
  },
);

// Lighthouse performance audit
registerToolLoose(
  "browserless_runLighthouseAudit",
  {
    description:
      "Run Lighthouse performance audit on a URL. Returns SEO, accessibility, best practices, and performance scores. Example: { url: 'https://example.com' }.",
    inputSchema: {
      apiKey: z
        .string()
        .optional()
        .describe("Browserless API key (optional if set in environment)"),
      url: z.string().url().describe("URL to audit"),
      config: z.record(z.unknown()).optional().describe("Lighthouse configuration options"),
      region: z
        .enum(["production-sfo", "production-lon", "production-ams"])
        .optional()
        .describe("Browserless region"),
      timeoutMs: z.number().int().positive().optional().describe("Request timeout in milliseconds"),
    },
  },
  async (rawParams): Promise<CallToolResult> => {
    const params = rawParams as {
      apiKey?: string;
      url: string;
      config?: Record<string, unknown>;
      region?: BrowserlessConfig["region"];
      timeoutMs?: number;
    };
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
      } catch (error: unknown) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: false, error: getErrorMessage(error) }, null, 2),
            },
          ],
        };
      }
    });
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LM Studio Browserless MCP server running on stdio");

  if (!hasConfiguredApiKey()) {
    console.error(
      "WARNING: BROWSERLESS_API_KEY/BROWSERLESS_API_TOKEN not set in environment. API key must be provided with each request.",
    );
  }
}

main().catch((error) => {
  console.error("MCP server startup failed:", error);
  process.exit(1);
});
