import dotenv from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { getClockSnapshot } from "./clock";

dotenv.config();

const server = new McpServer({
  name: "lm-studio-clock-tool",
  version: "1.0.0"
});

server.registerTool(
  "get_current_datetime",
  {
    description: "Returns current date/time/timezone information, optionally for a specific IANA timezone.",
    inputSchema: {
      timeZone: z
        .string()
        .optional()
        .describe("Optional IANA timezone such as 'UTC', 'America/New_York', or 'Asia/Kolkata'."),
      locale: z.string().optional().describe("Optional locale for readable names, e.g. 'en-US'.")
    } as any
  },
  async ({ timeZone, locale }: { timeZone?: string; locale?: string }): Promise<CallToolResult> => {
    const result = getClockSnapshot({ timeZone, locale });

    return {
      isError: !result.success,
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LM Studio Clock MCP server running on stdio");
}

main().catch((error) => {
  console.error("MCP server startup failed:", error);
  process.exit(1);
});
