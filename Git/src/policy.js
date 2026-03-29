var __importDefault =
  (this && this.__importDefault) || ((mod) => (mod && mod.__esModule ? mod : { default: mod }));
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRepoPath = validateRepoPath;
exports.isSafeBranchName = isSafeBranchName;
exports.canForcePush = canForcePush;
exports.canHardReset = canHardReset;
exports.validateCommitMessage = validateCommitMessage;
exports.validateCloneUrl = validateCloneUrl;
exports.canForceDeleteBranch = canForceDeleteBranch;
exports.getGitWorkspaceRoot = getGitWorkspaceRoot;
exports.canAmendCommit = canAmendCommit;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
/**
 * Validate repository path exists and is a Git repo
 */
function validateRepoPath(repoPath) {
  // Check if path exists
  if (!fs_1.default.existsSync(repoPath)) {
    return {
      valid: false,
      error: `Repository path does not exist: ${repoPath}`,
    };
  }
  // Check if it's a Git repository
  const gitDir = path_1.default.join(repoPath, ".git");
  if (!fs_1.default.existsSync(gitDir)) {
    return {
      valid: false,
      error: `Path is not a Git repository: ${repoPath}`,
    };
  }
  return { valid: true };
}
/**
 * Check if branch name is safe
 */
function isSafeBranchName(name) {
  // Block protected branches for force operations
  const protectedBranches = ["main", "master", "production", "prod", "release"];
  if (protectedBranches.includes(name.toLowerCase())) {
    return {
      safe: false,
      reason: `Branch '${name}' is protected and requires explicit approval for destructive operations`,
    };
  }
  // Check for invalid characters
  if (/[\s~^:?*\[\\]/.test(name)) {
    return {
      safe: false,
      reason: `Branch name contains invalid characters: ${name}`,
    };
  }
  // Check for leading/trailing special characters
  if (name.startsWith(".") || name.endsWith(".") || name.endsWith(".lock")) {
    return {
      safe: false,
      reason: `Branch name has invalid format: ${name}`,
    };
  }
  return { safe: true };
}
/**
 * Check if force push is allowed
 */
function canForcePush(branch) {
  const protectedBranches = ["main", "master", "production", "prod", "release"];
  if (protectedBranches.includes(branch.toLowerCase())) {
    return {
      allowed: false,
      reason: `Force push to protected branch '${branch}' is blocked`,
    };
  }
  return { allowed: true };
}
/**
 * Check if hard reset is allowed
 */
function canHardReset() {
  return {
    allowed: true,
    warning:
      "Hard reset will discard all uncommitted changes. Ensure you have backups or stashed changes.",
  };
}
/**
 * Validate commit message quality
 */
function validateCommitMessage(message) {
  // Minimum length
  if (message.length < 3) {
    return {
      valid: false,
      error: "Commit message too short (minimum 3 characters)",
    };
  }
  // Maximum length for first line
  const firstLine = message.split("\n")[0];
  if (firstLine.length > 100) {
    return {
      valid: false,
      error: "Commit message first line exceeds 100 characters (best practice: ≤72)",
    };
  }
  // Block placeholder messages
  const placeholders = ["wip", "todo", "fixme", "test", "asdf", "tmp", "temp"];
  if (placeholders.includes(message.toLowerCase().trim())) {
    return {
      valid: false,
      error: `Avoid placeholder commit messages like '${message}'`,
    };
  }
  return { valid: true };
}
/**
 * Validate clone URL is safe
 */
function validateCloneUrl(url) {
  // Allow HTTPS and SSH URLs
  const validProtocols = /^(https?:\/\/|git@)/;
  if (!validProtocols.test(url)) {
    return {
      safe: false,
      reason: `Invalid Git URL protocol. Use HTTPS or SSH: ${url}`,
    };
  }
  // Block file:// protocol (security risk)
  if (url.startsWith("file://")) {
    return {
      safe: false,
      reason: "file:// protocol is blocked for security",
    };
  }
  // Warn about unencrypted HTTP
  if (url.startsWith("http://")) {
    return {
      safe: false,
      reason: "Unencrypted HTTP URLs are blocked. Use HTTPS for secure cloning.",
    };
  }
  return { safe: true };
}
/**
 * Check if force delete is safe
 */
function canForceDeleteBranch(branch) {
  const protectedBranches = ["main", "master", "production", "prod", "release", "develop", "dev"];
  if (protectedBranches.includes(branch.toLowerCase())) {
    return {
      allowed: false,
      reason: `Cannot force delete protected branch: ${branch}`,
    };
  }
  return { allowed: true };
}
/**
 * Get workspace root for Git operations
 */
function getGitWorkspaceRoot() {
  const root =
    process.env.GIT_WORKSPACE_ROOT || process.env.FILE_EDITOR_WORKSPACE_ROOT || process.cwd();
  return path_1.default.resolve(root);
}
/**
 * Check if amend is safe (warn if on protected branch)
 */
function canAmendCommit(branch) {
  const protectedBranches = ["main", "master", "production", "prod", "release"];
  if (protectedBranches.includes(branch.toLowerCase())) {
    return {
      allowed: true,
      warning: `Amending commits on protected branch '${branch}' may cause issues if already pushed`,
    };
  }
  return { allowed: true };
}
//# sourceMappingURL=policy.js.map
