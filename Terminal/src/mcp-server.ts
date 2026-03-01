import { exec } from "child_process";
import dotenv from "dotenv";
import { platform } from "os";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  DEFAULT_MAX_OUTPUT_CHARS,
  WORKSPACE_ROOT,
  isCommandBlocked,
  resolveSafeCwd,
  truncateOutput,
} from "./policy";

dotenv.config();

const DEFAULT_TIMEOUT_MS = Number(process.env.TERMINAL_DEFAULT_TIMEOUT_MS ?? 60000);
const MAX_TIMEOUT_MS = Number(process.env.TERMINAL_MAX_TIMEOUT_MS ?? 120000);
const MAX_OUTPUT_CHARS = DEFAULT_MAX_OUTPUT_CHARS;

// Auto-detect operating system
const OPERATING_SYSTEM = (() => {
  const p = platform();
  if (p === "win32") return "Windows";
  if (p === "darwin") return "macOS";
  if (p === "linux") return "Linux";
  return "Unknown";
})();

const server = new McpServer({
  name: "lm-studio-terminal-tool",
  version: "1.0.0"
});

server.registerTool(
  "run_terminal_command",
  {
    description: `Executes a terminal command on ${OPERATING_SYSTEM}. Use for: running tests, building code, listing files, executing scripts. IMPORTANT: Use ONLY ${OPERATING_SYSTEM} commands—do NOT use commands from other OSs (e.g., use 'dir' not 'ls' on Windows). Always check 'success' flag and read 'stderr' if success=false.`,
    inputSchema: {
      command: z.string().min(1).describe(`The ${OPERATING_SYSTEM} shell command to execute (e.g., 'npm test', '${OPERATING_SYSTEM === "Windows" ? "dir" : "ls -la"}', 'python script.py'). MUST be appropriate for ${OPERATING_SYSTEM}. Non-interactive commands only.`),
      timeoutMs: z.number().int().positive().optional().describe("Timeout in milliseconds (1–120000, default 60000). Increase for slow tasks like full builds."),
      cwd: z.string().optional().describe("Working directory for command (absolute path recommended). Defaults to current dir.")
    } as any
  },
  async ({ command, timeoutMs, cwd }: any): Promise<CallToolResult> => {
    if (isCommandBlocked(command)) {
      const blockedResult = {
        success: false,
        errorCode: "POLICY_BLOCKED",
        errorMessage: "Command blocked by terminal safety policy.",
        timeoutMs: DEFAULT_TIMEOUT_MS
      };
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify(blockedResult, null, 2) }],
        structuredContent: blockedResult
      };
    }

    const safeCwd = resolveSafeCwd(WORKSPACE_ROOT, cwd);
    if (!safeCwd.ok) {
      const blockedResult = {
        success: false,
        errorCode: "POLICY_BLOCKED",
        errorMessage: safeCwd.message,
        timeoutMs: DEFAULT_TIMEOUT_MS
      };
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify(blockedResult, null, 2) }],
        structuredContent: blockedResult
      };
    }

    const effectiveTimeoutMs = Number.isFinite(timeoutMs)
      ? Math.min(Math.max(Number(timeoutMs), 1), MAX_TIMEOUT_MS)
      : DEFAULT_TIMEOUT_MS;

    return new Promise<CallToolResult>((resolve) => {
      exec(
        command,
        {
          timeout: effectiveTimeoutMs,
          cwd: safeCwd.cwd,
          windowsHide: true,
          maxBuffer: 10 * 1024 * 1024
        },
        (error, stdout, stderr) => {
          const truncatedStdout = truncateOutput(stdout, MAX_OUTPUT_CHARS);
          const truncatedStderr = truncateOutput(stderr, MAX_OUTPUT_CHARS);
          const result = {
            success: !error,
            code: error && "code" in error ? error.code : 0,
            signal: error && "signal" in error ? error.signal : null,
            stdout: truncatedStdout,
            stderr: truncatedStderr,
            errorCode: error ? "EXECUTION_FAILED" : undefined,
            errorMessage: error ? "Command execution failed." : undefined,
            policy: {
              workspaceRoot: WORKSPACE_ROOT,
              maxOutputChars: MAX_OUTPUT_CHARS
            },
            timeoutMs: effectiveTimeoutMs
          };

          resolve({
            isError: Boolean(error),
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            structuredContent: result
          });
        }
      );
    });
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LM Studio Terminal MCP server running on stdio");
}

main().catch((error) => {
  console.error("MCP server startup failed:", error);
  process.exit(1);
});
