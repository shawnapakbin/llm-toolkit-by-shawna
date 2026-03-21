var __importDefault =
  (this && this.__importDefault) || ((mod) => (mod && mod.__esModule ? mod : { default: mod }));
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePath = validatePath;
exports.isBlockedPath = isBlockedPath;
exports.isAllowedExtensionForWrite = isAllowedExtensionForWrite;
exports.validateFileSize = validateFileSize;
exports.validateContentSafety = validateContentSafety;
exports.getWorkspaceRoot = getWorkspaceRoot;
exports.canDelete = canDelete;
const path_1 = __importDefault(require("path"));
/**
 * Validate and sanitize file path to prevent directory traversal
 */
function validatePath(filePath, workspaceRoot) {
  // Normalize paths
  const normalized = path_1.default.normalize(filePath);
  const absolutePath = path_1.default.resolve(workspaceRoot, normalized);
  // Check for directory traversal
  if (!absolutePath.startsWith(workspaceRoot)) {
    return {
      valid: false,
      error: `Path traversal detected: ${filePath} escapes workspace boundary`,
    };
  }
  // Check for suspicious patterns
  if (normalized.includes("..")) {
    return {
      valid: false,
      error: `Invalid path: contains parent directory reference (..)`,
    };
  }
  return { valid: true };
}
/**
 * Check if file path matches deny patterns
 */
function isBlockedPath(filePath) {
  const normalized = path_1.default.normalize(filePath).toLowerCase();
  // Block sensitive system files
  const blockedPatterns = [
    // System files
    /\/etc\/passwd/,
    /\/etc\/shadow/,
    /\/etc\/sudoers/,
    /\/proc\//,
    /\/sys\//,
    /\/dev\//,
    /\/windows\/system32\//i,
    /\/winnt\/system32\//i,
    /c:\\windows\\system32\\/i,
    // Credential files
    /\.aws\/credentials/,
    /\.ssh\/id_rsa/,
    /\.ssh\/id_ed25519/,
    /\.gnupg\//,
    /\.password/,
    /\.npmrc/,
    /\.pypirc/,
    // Database files (prevent corruption)
    /\.db-wal$/,
    /\.db-shm$/,
    /\.sqlite-wal$/,
    /\.sqlite-shm$/,
  ];
  for (const pattern of blockedPatterns) {
    if (pattern.test(normalized)) {
      return {
        blocked: true,
        reason: `Access to sensitive path blocked: ${filePath}`,
      };
    }
  }
  return { blocked: false };
}
/**
 * Check if file extension is allowed for write operations
 */
function isAllowedExtensionForWrite(filePath) {
  const ext = path_1.default.extname(filePath).toLowerCase();
  // Block writing to executable and binary formats
  const blockedExtensions = [
    ".exe",
    ".dll",
    ".so",
    ".dylib",
    ".bin",
    ".app",
    ".msi",
    ".dmg",
    ".pkg",
    ".deb",
    ".rpm",
    ".bat",
    ".cmd",
    ".com",
    ".scr",
  ];
  if (blockedExtensions.includes(ext)) {
    return {
      allowed: false,
      reason: `Writing to executable/binary files is blocked: ${ext}`,
    };
  }
  return { allowed: true };
}
/**
 * Validate maximum file size for read operations
 */
function validateFileSize(size, maxSize = 10 * 1024 * 1024) {
  if (size > maxSize) {
    return {
      valid: false,
      error: `File size ${size} bytes exceeds maximum ${maxSize} bytes`,
    };
  }
  return { valid: true };
}
/**
 * Check if content contains suspicious patterns that might indicate malicious code
 */
function validateContentSafety(content) {
  // Check for common shell injection patterns
  const dangerousPatterns = [
    /rm\s+-rf\s+\//, // rm -rf /
    /\${IFS}/, // Shell variable abuse
    /eval\s*\(/, // eval() calls
    /<script[^>]*>[\s\S]*?<\/script>/i, // Script tags
    /\|\s*bash/, // Pipe to shell
    /\|\s*sh\s/, // Pipe to shell
    /&&\s*rm/, // Chained destructive commands
    /;\s*rm/, // Sequential destructive commands
  ];
  for (const pattern of dangerousPatterns) {
    if (pattern.test(content)) {
      return {
        safe: false,
        reason: `Content contains potentially dangerous pattern: ${pattern.source}`,
      };
    }
  }
  return { safe: true };
}
/**
 * Get workspace root from environment or default
 */
function getWorkspaceRoot() {
  const root = process.env.FILE_EDITOR_WORKSPACE_ROOT || process.cwd();
  return path_1.default.resolve(root);
}
/**
 * Check if delete operation is allowed
 */
function canDelete(filePath) {
  const normalized = path_1.default.normalize(filePath).toLowerCase();
  // Block deletion of critical project files
  const protectedFiles = [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    ".gitignore",
    ".env",
    "dockerfile",
    ".dockerignore",
  ];
  const basename = path_1.default.basename(normalized);
  if (protectedFiles.includes(basename)) {
    return {
      allowed: false,
      reason: `Cannot delete protected project file: ${basename}`,
    };
  }
  return { allowed: true };
}
//# sourceMappingURL=policy.js.map
