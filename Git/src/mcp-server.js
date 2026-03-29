var __importDefault =
  (this && this.__importDefault) || ((mod) => (mod && mod.__esModule ? mod : { default: mod }));
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const git_1 = require("./git");
const policy_1 = require("./policy");
dotenv_1.default.config();
const server = new mcp_js_1.McpServer({
  name: "git-tool",
  version: "1.0.0",
});
// git_status
server.registerTool(
  "git_status",
  {
    description:
      "View Git repository status and modified files. Shows staged, unstaged, and untracked files.",
    inputSchema: {
      short: zod_1.z
        .boolean()
        .optional()
        .describe("Use short format for concise output (default: false)"),
    },
  },
  async ({ short }) => {
    const repoPath = (0, policy_1.getGitWorkspaceRoot)();
    try {
      const result = await (0, git_1.gitStatus)({ short }, repoPath);
      return {
        isError: false,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: `Git status failed: ${error.message}` }],
      };
    }
  },
);
// git_diff
server.registerTool(
  "git_diff",
  {
    description:
      "View Git diff showing changes between commits, branches, or working directory. Shows line-by-line changes.",
    inputSchema: {
      target: zod_1.z
        .string()
        .optional()
        .describe("Branch/commit to diff against (e.g., 'main', 'HEAD~1')"),
      staged: zod_1.z.boolean().optional().describe("Show staged changes only (git diff --staged)"),
      file: zod_1.z.string().optional().describe("Limit diff to specific file path"),
    },
  },
  async ({ target, staged, file }) => {
    const repoPath = (0, policy_1.getGitWorkspaceRoot)();
    try {
      const result = await (0, git_1.gitDiff)({ target, staged, file }, repoPath);
      return {
        isError: false,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: `Git diff failed: ${error.message}` }],
      };
    }
  },
);
// git_log
server.registerTool(
  "git_log",
  {
    description:
      "View Git commit history with filtering options. Shows commit hashes, messages, authors, and dates.",
    inputSchema: {
      maxCount: zod_1.z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Maximum commits to show (default: 10)"),
      branch: zod_1.z
        .string()
        .optional()
        .describe("Branch to show log for (default: current branch)"),
      file: zod_1.z.string().optional().describe("Show log for specific file path only"),
      oneline: zod_1.z
        .boolean()
        .optional()
        .describe("Use oneline format for concise output (default: false)"),
    },
  },
  async ({ maxCount, branch, file, oneline }) => {
    const repoPath = (0, policy_1.getGitWorkspaceRoot)();
    try {
      const result = await (0, git_1.gitLog)({ maxCount, branch, file, oneline }, repoPath);
      return {
        isError: false,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: `Git log failed: ${error.message}` }],
      };
    }
  },
);
// git_branch
server.registerTool(
  "git_branch",
  {
    description:
      "Manage Git branches: list all branches, create new branches, or delete branches. Protected branches (main/master/production) cannot be force-deleted.",
    inputSchema: {
      action: zod_1.z
        .enum(["list", "create", "delete"])
        .describe(
          "Action to perform: 'list' (show all branches), 'create' (new branch), 'delete' (remove branch)",
        ),
      name: zod_1.z
        .string()
        .optional()
        .describe("Branch name (required for create/delete actions)"),
      force: zod_1.z
        .boolean()
        .optional()
        .describe("Force delete unmerged branch (default: false, blocked for protected branches)"),
    },
  },
  async ({ action, name, force }) => {
    const repoPath = (0, policy_1.getGitWorkspaceRoot)();
    try {
      const result = await (0, git_1.gitBranch)({ action, name, force }, repoPath);
      return {
        isError: false,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: `Git branch failed: ${error.message}` }],
      };
    }
  },
);
// git_checkout
server.registerTool(
  "git_checkout",
  {
    description: "Switch to a different branch or commit. Can create a new branch while switching.",
    inputSchema: {
      target: zod_1.z.string().describe("Branch name or commit hash to checkout"),
      createBranch: zod_1.z
        .boolean()
        .optional()
        .describe("Create new branch before checkout (default: false)"),
    },
  },
  async ({ target, createBranch }) => {
    const repoPath = (0, policy_1.getGitWorkspaceRoot)();
    try {
      const result = await (0, git_1.gitCheckout)({ target, createBranch }, repoPath);
      return {
        isError: false,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: `Git checkout failed: ${error.message}` }],
      };
    }
  },
);
// git_commit
server.registerTool(
  "git_commit",
  {
    description:
      "Create a Git commit with validation. Commit messages must be at least 3 characters and avoid placeholders (wip, todo, fixme). First line should be ≤100 chars.",
    inputSchema: {
      message: zod_1.z
        .string()
        .min(3)
        .describe("Commit message (min 3 chars, first line ≤100 chars recommended)"),
      all: zod_1.z.boolean().optional().describe("Stage all changes before commit (git commit -a)"),
      amend: zod_1.z.boolean().optional().describe("Amend previous commit (default: false)"),
    },
  },
  async ({ message, all, amend }) => {
    const repoPath = (0, policy_1.getGitWorkspaceRoot)();
    try {
      const result = await (0, git_1.gitCommit)({ message, all, amend }, repoPath);
      return {
        isError: false,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: `Git commit failed: ${error.message}` }],
      };
    }
  },
);
// git_push
server.registerTool(
  "git_push",
  {
    description:
      "Push commits to remote repository. Force push is BLOCKED for protected branches (main/master/production). Set upstream tracking for new branches.",
    inputSchema: {
      remote: zod_1.z.string().optional().describe("Remote name (default: 'origin')"),
      branch: zod_1.z.string().optional().describe("Branch to push (default: current)"),
      force: zod_1.z
        .boolean()
        .optional()
        .describe("Force push (default: false, BLOCKED for protected branches)"),
      setUpstream: zod_1.z
        .boolean()
        .optional()
        .describe("Set upstream tracking for new branch (default: false)"),
    },
  },
  async ({ remote, branch, force, setUpstream }) => {
    const repoPath = (0, policy_1.getGitWorkspaceRoot)();
    try {
      const result = await (0, git_1.gitPush)({ remote, branch, force, setUpstream }, repoPath);
      return {
        isError: false,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: `Git push failed: ${error.message}` }],
      };
    }
  },
);
// git_pull
server.registerTool(
  "git_pull",
  {
    description:
      "Pull changes from remote repository. Can use rebase instead of merge to maintain linear history.",
    inputSchema: {
      remote: zod_1.z.string().optional().describe("Remote name (default: 'origin')"),
      branch: zod_1.z.string().optional().describe("Branch to pull (default: current)"),
      rebase: zod_1.z.boolean().optional().describe("Use rebase instead of merge (default: false)"),
    },
  },
  async ({ remote, branch, rebase }) => {
    const repoPath = (0, policy_1.getGitWorkspaceRoot)();
    try {
      const result = await (0, git_1.gitPull)({ remote, branch, rebase }, repoPath);
      return {
        isError: false,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: `Git pull failed: ${error.message}` }],
      };
    }
  },
);
// git_clone
server.registerTool(
  "git_clone",
  {
    description:
      "Clone a Git repository. Only HTTPS and SSH URLs are allowed (http:// and file:// are BLOCKED for security). Supports shallow clones for faster downloads.",
    inputSchema: {
      url: zod_1.z
        .string()
        .describe("Repository URL (https:// or git@ only, http:// and file:// blocked)"),
      directory: zod_1.z
        .string()
        .optional()
        .describe("Target directory name (default: repo name from URL)"),
      branch: zod_1.z
        .string()
        .optional()
        .describe("Specific branch to clone (default: remote's default branch)"),
      depth: zod_1.z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Shallow clone depth (e.g., 1 for latest commit only)"),
    },
  },
  async ({ url, directory, branch, depth }) => {
    const repoPath = (0, policy_1.getGitWorkspaceRoot)();
    try {
      const result = await (0, git_1.gitClone)({ url, directory, branch, depth }, repoPath);
      return {
        isError: false,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: `Git clone failed: ${error.message}` }],
      };
    }
  },
);
// git_stash
server.registerTool(
  "git_stash",
  {
    description:
      "Manage Git stash: save uncommitted changes, restore stashed changes, list all stashes, or drop specific stashes. Useful for temporarily saving work.",
    inputSchema: {
      action: zod_1.z
        .enum(["save", "pop", "list", "drop"])
        .describe(
          "Action: 'save' (stash changes), 'pop' (apply & remove stash), 'list' (show stashes), 'drop' (delete stash)",
        ),
      message: zod_1.z.string().optional().describe("Stash message for 'save' action"),
      index: zod_1.z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe("Stash index for 'pop'/'drop' actions (default: 0 = latest)"),
    },
  },
  async ({ action, message, index }) => {
    const repoPath = (0, policy_1.getGitWorkspaceRoot)();
    try {
      const result = await (0, git_1.gitStash)({ action, message, index }, repoPath);
      return {
        isError: false,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: `Git stash failed: ${error.message}` }],
      };
    }
  },
);
// git_reset
server.registerTool(
  "git_reset",
  {
    description:
      "Reset repository to a previous state. SOFT (keep changes staged), MIXED (keep changes unstaged), HARD (discard all changes). HARD mode is DESTRUCTIVE and requires explicit confirmation.",
    inputSchema: {
      mode: zod_1.z
        .enum(["soft", "mixed", "hard"])
        .describe(
          "Reset mode: 'soft' (keep staged), 'mixed' (keep unstaged), 'hard' (DISCARD ALL)",
        ),
      target: zod_1.z.string().optional().describe("Commit/branch to reset to (default: 'HEAD')"),
    },
  },
  async ({ mode, target }) => {
    const repoPath = (0, policy_1.getGitWorkspaceRoot)();
    try {
      const result = await (0, git_1.gitReset)({ mode, target }, repoPath);
      return {
        isError: false,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: `Git reset failed: ${error.message}` }],
      };
    }
  },
);
async function main() {
  const transport = new stdio_js_1.StdioServerTransport();
  await server.connect(transport);
  console.error("Git MCP server running on stdio");
}
main().catch((error) => {
  console.error("MCP server startup failed:", error);
  process.exit(1);
});
//# sourceMappingURL=mcp-server.js.map
