"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitResetSchema = exports.GitStashSchema = exports.GitCloneSchema = exports.GitPullSchema = exports.GitPushSchema = exports.GitCommitSchema = exports.GitCheckoutSchema = exports.GitBranchSchema = exports.GitLogSchema = exports.GitDiffSchema = exports.GitStatusSchema = void 0;
exports.gitStatus = gitStatus;
exports.gitDiff = gitDiff;
exports.gitLog = gitLog;
exports.gitBranch = gitBranch;
exports.gitCheckout = gitCheckout;
exports.gitCommit = gitCommit;
exports.gitPush = gitPush;
exports.gitPull = gitPull;
exports.gitClone = gitClone;
exports.gitStash = gitStash;
exports.gitReset = gitReset;
const child_process_1 = require("child_process");
const util_1 = require("util");
const path_1 = __importDefault(require("path"));
const zod_1 = require("zod");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
exports.GitStatusSchema = zod_1.z.object({
    short: zod_1.z.boolean().optional().default(false),
});
exports.GitDiffSchema = zod_1.z.object({
    target: zod_1.z.string().optional(),
    staged: zod_1.z.boolean().optional().default(false),
    file: zod_1.z.string().optional(),
});
exports.GitLogSchema = zod_1.z.object({
    maxCount: zod_1.z.number().int().positive().optional().default(10),
    branch: zod_1.z.string().optional(),
    file: zod_1.z.string().optional(),
    oneline: zod_1.z.boolean().optional().default(false),
});
exports.GitBranchSchema = zod_1.z.object({
    action: zod_1.z.enum(["list", "create", "delete"]),
    name: zod_1.z.string().optional(),
    force: zod_1.z.boolean().optional().default(false),
});
exports.GitCheckoutSchema = zod_1.z.object({
    target: zod_1.z.string().min(1, "branch or commit required"),
    createBranch: zod_1.z.boolean().optional().default(false),
});
exports.GitCommitSchema = zod_1.z.object({
    message: zod_1.z.string().min(1, "commit message required"),
    all: zod_1.z.boolean().optional().default(false),
    amend: zod_1.z.boolean().optional().default(false),
});
exports.GitPushSchema = zod_1.z.object({
    remote: zod_1.z.string().optional().default("origin"),
    branch: zod_1.z.string().optional(),
    force: zod_1.z.boolean().optional().default(false),
    setUpstream: zod_1.z.boolean().optional().default(false),
});
exports.GitPullSchema = zod_1.z.object({
    remote: zod_1.z.string().optional().default("origin"),
    branch: zod_1.z.string().optional(),
    rebase: zod_1.z.boolean().optional().default(false),
});
exports.GitCloneSchema = zod_1.z.object({
    url: zod_1.z.string().min(1, "repository URL required"),
    directory: zod_1.z.string().optional(),
    branch: zod_1.z.string().optional(),
    depth: zod_1.z.number().int().positive().optional(),
});
exports.GitStashSchema = zod_1.z.object({
    action: zod_1.z.enum(["save", "pop", "list", "drop"]),
    message: zod_1.z.string().optional(),
    index: zod_1.z.number().int().nonnegative().optional(),
});
exports.GitResetSchema = zod_1.z.object({
    mode: zod_1.z.enum(["soft", "mixed", "hard"]),
    target: zod_1.z.string().optional().default("HEAD"),
});
const TIMEOUT_MS = 30000; // 30 seconds
async function runGitCommand(command, cwd) {
    try {
        const result = await execAsync(command, {
            cwd,
            timeout: TIMEOUT_MS,
            maxBuffer: 5 * 1024 * 1024, // 5MB
        });
        return result;
    }
    catch (error) {
        // Git commands may have stderr even on success
        return {
            stdout: error.stdout || "",
            stderr: error.stderr || error.message,
        };
    }
}
/**
 * Get repository status
 */
async function gitStatus(input, repoPath) {
    const shortFlag = input.short ? "--short" : "";
    const { stdout } = await runGitCommand(`git status ${shortFlag}`, repoPath);
    // Extract modified files
    const files = [];
    const lines = stdout.split("\n");
    for (const line of lines) {
        const match = line.match(/^\s*(?:modified|new file|deleted|renamed):\s+(.+)$/);
        if (match)
            files.push(match[1].trim());
    }
    return {
        output: stdout,
        files,
    };
}
/**
 * View diff
 */
async function gitDiff(input, repoPath) {
    let command = "git diff";
    if (input.staged)
        command += " --staged";
    if (input.target)
        command += ` ${input.target}`;
    if (input.file)
        command += ` -- ${input.file}`;
    const { stdout } = await runGitCommand(command, repoPath);
    // Count files changed
    const filesChanged = (stdout.match(/^diff --git/gm) || []).length;
    return {
        output: stdout,
        filesChanged,
    };
}
/**
 * View commit history
 */
async function gitLog(input, repoPath) {
    let command = `git log --max-count=${input.maxCount}`;
    if (input.oneline)
        command += " --oneline";
    if (input.branch)
        command += ` ${input.branch}`;
    if (input.file)
        command += ` -- ${input.file}`;
    const { stdout } = await runGitCommand(command, repoPath);
    // Parse commits
    const commits = [];
    if (input.oneline) {
        const lines = stdout.split("\n").filter((l) => l.trim());
        for (const line of lines) {
            const match = line.match(/^([a-f0-9]+)\s+(.+)$/);
            if (match) {
                commits.push({ hash: match[1], message: match[2] });
            }
        }
    }
    return {
        output: stdout,
        commits,
    };
}
/**
 * Manage branches
 */
async function gitBranch(input, repoPath) {
    let command = "git branch";
    if (input.action === "list") {
        const { stdout } = await runGitCommand(command, repoPath);
        const lines = stdout.split("\n").filter((l) => l.trim());
        const branches = lines.map((l) => l.replace("*", "").trim());
        const current = lines.find((l) => l.startsWith("*"))?.replace("*", "").trim();
        return {
            output: stdout,
            branches,
            current,
        };
    }
    if (input.action === "create") {
        if (!input.name)
            throw new Error("branch name required for create");
        command = `git branch ${input.name}`;
    }
    if (input.action === "delete") {
        if (!input.name)
            throw new Error("branch name required for delete");
        const flag = input.force ? "-D" : "-d";
        command = `git branch ${flag} ${input.name}`;
    }
    const { stdout } = await runGitCommand(command, repoPath);
    return { output: stdout };
}
/**
 * Checkout branch or commit
 */
async function gitCheckout(input, repoPath) {
    let command = "git checkout";
    if (input.createBranch)
        command += " -b";
    command += ` ${input.target}`;
    const { stdout } = await runGitCommand(command, repoPath);
    // Get current branch
    const { stdout: branchOut } = await runGitCommand("git branch --show-current", repoPath);
    const branch = branchOut.trim();
    return {
        output: stdout,
        branch,
    };
}
/**
 * Create commit
 */
async function gitCommit(input, repoPath) {
    let command = "git commit";
    if (input.all)
        command += " -a";
    if (input.amend)
        command += " --amend";
    command += ` -m "${input.message.replace(/"/g, '\\"')}"`;
    const { stdout } = await runGitCommand(command, repoPath);
    // Extract commit hash
    const match = stdout.match(/\[.+\s([a-f0-9]+)\]/);
    const hash = match ? match[1] : "";
    return {
        output: stdout,
        hash,
    };
}
/**
 * Push to remote
 */
async function gitPush(input, repoPath) {
    let command = `git push ${input.remote}`;
    if (input.branch)
        command += ` ${input.branch}`;
    if (input.force)
        command += " --force";
    if (input.setUpstream)
        command += " --set-upstream";
    const { stdout, stderr } = await runGitCommand(command, repoPath);
    return {
        output: stdout || stderr,
    };
}
/**
 * Pull from remote
 */
async function gitPull(input, repoPath) {
    let command = `git pull ${input.remote}`;
    if (input.branch)
        command += ` ${input.branch}`;
    if (input.rebase)
        command += " --rebase";
    const { stdout, stderr } = await runGitCommand(command, repoPath);
    return {
        output: stdout || stderr,
    };
}
/**
 * Clone repository
 */
async function gitClone(input, repoPath) {
    let command = `git clone ${input.url}`;
    if (input.directory)
        command += ` ${input.directory}`;
    if (input.branch)
        command += ` --branch ${input.branch}`;
    if (input.depth)
        command += ` --depth ${input.depth}`;
    const { stdout, stderr } = await runGitCommand(command, repoPath);
    // Determine cloned directory
    const directory = input.directory || path_1.default.basename(input.url, ".git");
    return {
        output: stdout || stderr,
        directory,
    };
}
/**
 * Stash operations
 */
async function gitStash(input, repoPath) {
    let command = "git stash";
    switch (input.action) {
        case "save":
            command += " push";
            if (input.message)
                command += ` -m "${input.message.replace(/"/g, '\\"')}"`;
            break;
        case "pop":
            command += " pop";
            if (input.index !== undefined)
                command += ` stash@{${input.index}}`;
            break;
        case "list":
            command += " list";
            break;
        case "drop":
            command += " drop";
            if (input.index !== undefined)
                command += ` stash@{${input.index}}`;
            break;
    }
    const { stdout } = await runGitCommand(command, repoPath);
    // Parse stash list
    let stashes;
    if (input.action === "list") {
        stashes = [];
        const lines = stdout.split("\n").filter((l) => l.trim());
        for (const line of lines) {
            const match = line.match(/^stash@\{(\d+)\}:\s+(.+)$/);
            if (match) {
                stashes.push({ index: Number.parseInt(match[1], 10), message: match[2] });
            }
        }
    }
    return {
        output: stdout,
        stashes,
    };
}
/**
 * Reset repository state
 */
async function gitReset(input, repoPath) {
    const command = `git reset --${input.mode} ${input.target}`;
    const { stdout } = await runGitCommand(command, repoPath);
    return {
        output: stdout,
    };
}
//# sourceMappingURL=git.js.map