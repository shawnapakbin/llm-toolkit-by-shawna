import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import { z } from "zod";
import { browseWeb } from "./browser";

dotenv.config();

const DEFAULT_TIMEOUT_MS = Number(process.env.BROWSER_DEFAULT_TIMEOUT_MS ?? 20000);
const MAX_TIMEOUT_MS = Number(process.env.BROWSER_MAX_TIMEOUT_MS ?? 60000);
const MAX_CONTENT_CHARS = Number(process.env.BROWSER_MAX_CONTENT_CHARS ?? 12000);

type BrowseWebInput = {
  url: string;
  timeoutMs?: number;
  maxContentChars?: number;
};

const server = new McpServer({
  name: "lm-studio-web-browser-tool",
  version: "1.0.0",
});

const browseWebInputSchema: Record<string, z.ZodTypeAny> = {
  url: z.string().url().describe("The full URL to fetch, including http:// or https://."),
  timeoutMs: z.number().int().positive().optional().describe("Request timeout in milliseconds."),
  maxContentChars: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Maximum returned content length in characters."),
};

const registerTool = server.registerTool.bind(server) as unknown as (
  name: string,
  config: { description: string; inputSchema: unknown },
  handler: (input: unknown) => Promise<CallToolResult>,
) => void;

registerTool(
  "browse_web",
  {
    description: "Fetches a web page and returns title and extracted text content.",
    inputSchema: browseWebInputSchema,
  },
  async (input): Promise<CallToolResult> => {
    const { url, timeoutMs, maxContentChars } = input as BrowseWebInput;
    const effectiveTimeoutMs = Number.isFinite(timeoutMs)
      ? Math.min(Math.max(Number(timeoutMs), 1), MAX_TIMEOUT_MS)
      : DEFAULT_TIMEOUT_MS;

    const effectiveMaxContentChars = Number.isFinite(maxContentChars)
      ? Math.min(Math.max(Number(maxContentChars), 200), MAX_CONTENT_CHARS)
      : MAX_CONTENT_CHARS;

    const result = await browseWeb({
      url,
      timeoutMs: effectiveTimeoutMs,
      maxContentChars: effectiveMaxContentChars,
    });

    return {
      isError: !result.success,
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LM Studio Web Browser MCP server running on stdio");
}

main().catch((error) => {
  console.error("MCP server startup failed:", error);
  process.exit(1);
});
