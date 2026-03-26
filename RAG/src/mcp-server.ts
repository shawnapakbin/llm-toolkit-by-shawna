import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import { z } from "zod";
import { handleRAGRequest } from "./rag";
import type { RagAction, RagRequest } from "./types";

dotenv.config();

export function createRAGMcpServer(): McpServer {
  const server = new McpServer({
    name: "lm-studio-rag-tool",
    version: "1.0.0",
  });

  const registerTool = server.registerTool.bind(server) as unknown as (
    name: string,
    config: { description: string; inputSchema: unknown },
    handler: (input: unknown) => Promise<CallToolResult>,
  ) => void;

  registerTool(
    "rag_knowledge",
    {
      description:
        "Knowledge base RAG tool: ingest documents, query knowledge, or manage sources. Use ONLY for: (1) ingest_documents—add files/URLs/text to KB, (2) query_knowledge—search KB by query, (3) list_sources—show indexed sources, (4) delete_source—remove sources, (5) reindex_source—reprocess source. NOT for general tasks.",
      inputSchema: z.discriminatedUnion("action", [
        z.object({
          action: z.literal("ingest_documents"),
          payload: z
            .object({
              documents: z
                .array(
                  z
                    .object({
                      sourceKey: z.string().optional(),
                      title: z.string().optional(),
                      text: z.string().optional(),
                      filePath: z.string().optional(),
                      url: z.string().url().optional(),
                      metadata: z.record(z.unknown()).optional(),
                    })
                    .strict(),
                )
                .describe("Array of documents: at least one of text/filePath/url"),
              chunkSizeTokens: z
                .number()
                .int()
                .min(100)
                .max(4000)
                .optional()
                .describe("Chunk size in tokens (default 512)"),
              overlapTokens: z
                .number()
                .int()
                .min(0)
                .max(500)
                .optional()
                .describe("Overlap between chunks (default 50)"),
              approvalInterviewId: z
                .string()
                .optional()
                .describe("Approval interview ID if approval was obtained"),
              approvalToken: z
                .string()
                .optional()
                .describe(
                  "One-time approval token returned by a previous approval_required response",
                ),
            })
            .strict(),
        }),
        z.object({
          action: z.literal("query_knowledge"),
          payload: z
            .object({
              query: z.string().min(1).describe("Search query text"),
              topK: z
                .number()
                .int()
                .min(1)
                .max(20)
                .optional()
                .describe("Number of results (default 5)"),
              sourceIds: z.array(z.string()).optional().describe("Filter by source IDs"),
              sourceKeys: z.array(z.string()).optional().describe("Filter by source keys"),
              minScore: z.number().min(0).max(1).optional().describe("Minimum relevance score (0–1)"),
            })
            .strict(),
        }),
        z.object({
          action: z.literal("list_sources"),
          payload: z
            .object({
              limit: z.number().int().min(1).max(100).optional().describe("Max results (default 20)"),
              offset: z.number().int().min(0).optional().describe("Pagination offset (default 0)"),
            })
            .strict(),
        }),
        z.object({
          action: z.literal("delete_source"),
          payload: z
            .object({
              sourceId: z.string().describe("Source ID to delete"),
              approvalInterviewId: z
                .string()
                .optional()
                .describe("Required if source deletion needs approval"),
              approvalToken: z
                .string()
                .optional()
                .describe(
                  "One-time approval token returned by a previous approval_required response",
                ),
            })
            .strict(),
        }),
        z.object({
          action: z.literal("reindex_source"),
          payload: z
            .object({
              sourceId: z.string().describe("Source ID to reprocess"),
              chunkSizeTokens: z.number().int().min(100).max(4000).optional(),
              overlapTokens: z.number().int().min(0).max(500).optional(),
              approvalInterviewId: z.string().optional(),
              approvalToken: z
                .string()
                .optional()
                .describe(
                  "One-time approval token returned by a previous approval_required response",
                ),
            })
            .strict(),
        }),
      ]),
    },
    async (input): Promise<CallToolResult> => {
      const { action, payload } = input as {
        action: RagRequest["action"];
        payload: RagRequest["payload"];
      };
      const result = await handleRAGRequest({
        action: action as RagAction,
        payload,
      });

      return {
        isError: !result.success,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );

  return server;
}

async function main() {
  const server = createRAGMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LM Studio RAG MCP server running on stdio");
}

if (require.main === module) {
  main().catch((error) => {
    console.error("MCP server startup failed:", error);
    process.exit(1);
  });
}
