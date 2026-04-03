/**
 * Slash Commands MCP Server
 *
 * Exposes a single `slash_command` tool. When the user types /compact,
 * /calc, /browse etc. in LM Studio chat, the LLM calls this tool with
 * the raw input. The server parses and dispatches to the right tool
 * internally — no system prompt injection required.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import { z } from "zod";
import { parseSlashCommand } from "./parser";
import { route } from "./router";

dotenv.config();

const COMMAND_REFERENCE = `
Supported slash commands:
  /help
  /compact [--session <id>] [--keep-newest <n>]
  /ecm store <text> [--session <id>] [--type <type>] [--importance <0-1>]
  /ecm retrieve <query> [--session <id>] [--top-k <n>]
  /ecm list [--session <id>]
  /ecm summarize [--session <id>] [--keep-newest <n>]
  /ecm clear [--session <id>]
  /calc <expression> [--precision <n>]
  /browse <url> [--format text|markdown|html] [--screenshot] [--wait-selector <css>]
  /clock [--timezone <iana-tz>]
  /run <shell command> [--cwd <dir>]
  /skills list
  /skills get <name>
  /skills run <name> [--params <json>]
  /skills delete <name>
  /rag query <text> [--top-k <n>]
  /rag ingest <text> [--source <label>]
  /rag list
  /rag delete <sourceId>
  /ask <prompt> [--title <title>] [--expires <seconds>]
  /tools list
  /tools health [<tool-name>]
  /tools schema <tool-name>
  /memory stats
  /memory history [--limit <n>]
  /memory patterns
  /config show
`.trim();

export function createSlashCommandsMcpServer(): McpServer {
  const server = new McpServer({
    name: "llm-toolkit-slash-commands",
    version: "1.0.0",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (server.registerTool as any)(
    "slash_command",
    {
      description: `Executes a slash command typed by the user in chat.
When the user's message starts with "/" (e.g. /compact, /calc, /browse), call this tool with the full raw input.
The server parses the command and dispatches it to the appropriate tool automatically.

${COMMAND_REFERENCE}`,
      inputSchema: {
        input: z
          .string()
          .describe(
            'The full slash command as typed by the user, e.g. "/compact", "/calc sin(30°)", "/browse https://example.com --format text"',
          ),
      },
    },
    async ({ input }: { input: string }): Promise<CallToolResult> => {
      let result: unknown;
      try {
        const descriptor = parseSlashCommand(input);
        result = await route(descriptor);
      } catch (err) {
        result = {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }

      const res = result as { success?: boolean };
      return {
        isError: res.success === false,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    },
  );

  return server;
}

async function main() {
  const server = createSlashCommandsMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LLM Toolkit Slash Commands MCP server running on stdio");
}

if (require.main === module) {
  main().catch((err) => {
    console.error("MCP server startup failed:", err);
    process.exit(1);
  });
}
