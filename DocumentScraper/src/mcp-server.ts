import dotenv from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { crawlDocuments, readDocument } from "./document-scraper";

dotenv.config();

const server = new McpServer({
  name: "lm-studio-document-scraper-tool",
  version: "1.0.0",
});

server.registerTool(
  "read_document",
  {
    description: "Reads local or remote documents with structured extraction and encrypted PDF notifications.",
    inputSchema: {
      url: z.string().url().optional().describe("Remote URL to fetch."),
      filePath: z.string().optional().describe("Workspace-relative local file path."),
      headers: z.record(z.string()).optional(),
      cookies: z.string().optional(),
      timeoutMs: z.number().int().positive().optional(),
      maxContentChars: z.number().int().positive().optional(),
      formatHint: z.string().optional(),
      profile: z.enum(["mvp", "premium"]).optional(),
      pdfPassword: z.string().optional().describe("Premium mode only."),
    } as any,
  },
  async (input: any): Promise<CallToolResult> => {
    const result = await readDocument(input);
    return {
      isError: !result.success,
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  }
);

server.registerTool(
  "crawl_documents",
  {
    description: "Crawls linked pages up to a configured depth and returns extracted document results.",
    inputSchema: {
      url: z.string().url().describe("Root URL to crawl."),
      headers: z.record(z.string()).optional(),
      cookies: z.string().optional(),
      timeoutMs: z.number().int().positive().optional(),
      maxContentChars: z.number().int().positive().optional(),
      depth: z.number().int().min(0).max(3).optional(),
      maxPages: z.number().int().min(1).max(20).optional(),
      sameOriginOnly: z.boolean().optional(),
    } as any,
  },
  async (input: any): Promise<CallToolResult> => {
    const result = await crawlDocuments(input);
    return {
      isError: !result.success,
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LM Studio Document Scraper MCP server running on stdio");
}

main().catch((error) => {
  console.error("MCP server startup failed:", error);
  process.exit(1);
});
