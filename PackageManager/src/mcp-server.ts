import dotenv from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  detectPackageManager,
  installPackages,
  updatePackages,
  auditVulnerabilities,
  listOutdated,
  removeDependencies,
  viewDependencies,
  lockDependencies,
} from "./package-manager";
import { getPackageManagerWorkspaceRoot } from "./policy";

dotenv.config();

const server = new McpServer({
  name: "package-manager-tool",
  version: "1.0.0",
});

// detect_package_manager
server.registerTool(
  "detect_package_manager",
  {
    description:
      "Auto-detect the package manager used in the project (npm, pip, cargo, maven, gradle, go). Returns detected manager and list of available managers.",
    inputSchema: {} as any,
  },
  async (): Promise<CallToolResult> => {
    const repoPath = getPackageManagerWorkspaceRoot();
    try {
      const result = await detectPackageManager(repoPath);
      return {
        isError: false,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [{ type: "text", text: `Package manager detection failed: ${error.message}` }],
      };
    }
  },
);

// install_packages
server.registerTool(
  "install_packages",
  {
    description:
      "Install packages in the project using the detected package manager. Supports npm, pip, cargo, maven, go.",
    inputSchema: {
      packages: z
        .array(z.string())
        .min(1)
        .describe("Package names to install (e.g., ['express', 'lodash'])"),
      dev: z.boolean().optional().describe("Install as development dependency (default: false)"),
      global: z.boolean().optional().describe("Install globally (default: false)"),
    } as any,
  },
  async ({ packages, dev, global }: any): Promise<CallToolResult> => {
    const repoPath = getPackageManagerWorkspaceRoot();
    try {
      const detection = await detectPackageManager(repoPath);
      if (!detection.detected) {
        return {
          isError: true,
          content: [{ type: "text", text: "No package manager detected" }],
        };
      }

      const result = await installPackages(
        { packages, dev, global },
        detection.detected.manager,
        repoPath
      );
      return {
        isError: false,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [{ type: "text", text: `Install failed: ${error.message}` }],
      };
    }
  },
);

// update_packages
server.registerTool(
  "update_packages",
  {
    description:
      "Update packages to newer versions. Can update specific packages or all packages.",
    inputSchema: {
      packages: z
        .array(z.string())
        .optional()
        .describe("Specific packages to update"),
      all: z.boolean().optional().describe("Update all packages (default: false)"),
      check: z
        .boolean()
        .optional()
        .describe("Only check for updates without installing (default: false)"),
    } as any,
  },
  async ({ packages, all, check }: any): Promise<CallToolResult> => {
    const repoPath = getPackageManagerWorkspaceRoot();
    try {
      const detection = await detectPackageManager(repoPath);
      if (!detection.detected) {
        return {
          isError: true,
          content: [{ type: "text", text: "No package manager detected" }],
        };
      }

      const result = await updatePackages({ packages, all, check }, detection.detected.manager, repoPath);
      return {
        isError: false,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [{ type: "text", text: `Update failed: ${error.message}` }],
      };
    }
  },
);

// audit_vulnerabilities
server.registerTool(
  "audit_vulnerabilities",
  {
    description:
      "Audit dependencies for security vulnerabilities. Optionally fix vulnerabilities automatically.",
    inputSchema: {
      fix: z.boolean().optional().describe("Automatically fix vulnerabilities (default: false)"),
      severity: z
        .enum(["low", "moderate", "high", "critical"])
        .optional()
        .describe("Filter by severity level"),
    } as any,
  },
  async ({ fix, severity }: any): Promise<CallToolResult> => {
    const repoPath = getPackageManagerWorkspaceRoot();
    try {
      const detection = await detectPackageManager(repoPath);
      if (!detection.detected) {
        return {
          isError: true,
          content: [{ type: "text", text: "No package manager detected" }],
        };
      }

      const result = await auditVulnerabilities({ fix, severity }, detection.detected.manager, repoPath);
      return {
        isError: false,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [{ type: "text", text: `Audit failed: ${error.message}` }],
      };
    }
  },
);

// list_outdated
server.registerTool(
  "list_outdated",
  {
    description: "List outdated packages with available updates.",
    inputSchema: {
      format: z
        .enum(["list", "json", "outdated"])
        .optional()
        .describe("Output format (default: list)"),
    } as any,
  },
  async ({ format }: any): Promise<CallToolResult> => {
    const repoPath = getPackageManagerWorkspaceRoot();
    try {
      const detection = await detectPackageManager(repoPath);
      if (!detection.detected) {
        return {
          isError: true,
          content: [{ type: "text", text: "No package manager detected" }],
        };
      }

      const result = await listOutdated({ format }, detection.detected.manager, repoPath);
      return {
        isError: false,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [{ type: "text", text: `List outdated failed: ${error.message}` }],
      };
    }
  },
);

// remove_dependencies
server.registerTool(
  "remove_dependencies",
  {
    description: "Remove packages from the project.",
    inputSchema: {
      packages: z
        .array(z.string())
        .min(1)
        .describe("Package names to remove"),
    } as any,
  },
  async ({ packages }: any): Promise<CallToolResult> => {
    const repoPath = getPackageManagerWorkspaceRoot();
    try {
      const detection = await detectPackageManager(repoPath);
      if (!detection.detected) {
        return {
          isError: true,
          content: [{ type: "text", text: "No package manager detected" }],
        };
      }

      const result = await removeDependencies({ packages }, detection.detected.manager, repoPath);
      return {
        isError: false,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [{ type: "text", text: `Remove failed: ${error.message}` }],
      };
    }
  },
);

// view_dependencies
server.registerTool(
  "view_dependencies",
  {
    description:
      "View project dependencies in a tree structure or list format. Supports filtering by depth and direct dependencies only.",
    inputSchema: {
      depth: z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe("Tree depth to display (default: 0 = all)"),
      onlyDirect: z
        .boolean()
        .optional()
        .describe("Show only direct dependencies (default: false)"),
    } as any,
  },
  async ({ depth, onlyDirect }: any): Promise<CallToolResult> => {
    const repoPath = getPackageManagerWorkspaceRoot();
    try {
      const detection = await detectPackageManager(repoPath);
      if (!detection.detected) {
        return {
          isError: true,
          content: [{ type: "text", text: "No package manager detected" }],
        };
      }

      const result = await viewDependencies({ depth, onlyDirect }, detection.detected.manager, repoPath);
      return {
        isError: false,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [{ type: "text", text: `View dependencies failed: ${error.message}` }],
      };
    }
  },
);

// lock_dependencies
server.registerTool(
  "lock_dependencies",
  {
    description:
      "Lock or freeze dependencies to ensure reproducible builds. Supports frozen installs (ci) or updating lock files.",
    inputSchema: {
      frozen: z
        .boolean()
        .optional()
        .describe("Use frozen/ci mode for reproducible installs (default: true)"),
    } as any,
  },
  async ({ frozen }: any): Promise<CallToolResult> => {
    const repoPath = getPackageManagerWorkspaceRoot();
    try {
      const detection = await detectPackageManager(repoPath);
      if (!detection.detected) {
        return {
          isError: true,
          content: [{ type: "text", text: "No package manager detected" }],
        };
      }

      const result = await lockDependencies({ frozen }, detection.detected.manager, repoPath);
      return {
        isError: false,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [{ type: "text", text: `Lock dependencies failed: ${error.message}` }],
      };
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("PackageManager MCP server running on stdio");
}

main().catch((error) => {
  console.error("MCP server startup failed:", error);
  process.exit(1);
});
