"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MoveFileSchema = exports.DeleteFileSchema = exports.ListDirectorySchema = exports.SearchFilesSchema = exports.WriteFileSchema = exports.ReadFileSchema = void 0;
exports.readFile = readFile;
exports.writeFile = writeFile;
exports.searchFiles = searchFiles;
exports.listDirectory = listDirectory;
exports.deleteFile = deleteFile;
exports.moveFile = moveFile;
const promises_1 = __importDefault(require("fs/promises"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const zod_1 = require("zod");
exports.ReadFileSchema = zod_1.z.object({
    path: zod_1.z.string().min(1, "file path required"),
    startLine: zod_1.z.number().int().positive().optional(),
    endLine: zod_1.z.number().int().positive().optional(),
});
exports.WriteFileSchema = zod_1.z.object({
    path: zod_1.z.string().min(1, "file path required"),
    content: zod_1.z.string(),
    createBackup: zod_1.z.boolean().optional().default(false),
    mode: zod_1.z.enum(["overwrite", "append"]).optional().default("overwrite"),
});
exports.SearchFilesSchema = zod_1.z.object({
    pattern: zod_1.z.string().min(1, "search pattern required"),
    directory: zod_1.z.string().optional(),
    fileExtensions: zod_1.z.array(zod_1.z.string()).optional(),
    maxResults: zod_1.z.number().int().positive().optional().default(50),
    caseSensitive: zod_1.z.boolean().optional().default(false),
});
exports.ListDirectorySchema = zod_1.z.object({
    path: zod_1.z.string().min(1, "directory path required"),
    recursive: zod_1.z.boolean().optional().default(false),
    includeHidden: zod_1.z.boolean().optional().default(false),
});
exports.DeleteFileSchema = zod_1.z.object({
    path: zod_1.z.string().min(1, "file path required"),
    createBackup: zod_1.z.boolean().optional().default(true),
});
exports.MoveFileSchema = zod_1.z.object({
    source: zod_1.z.string().min(1, "source path required"),
    destination: zod_1.z.string().min(1, "destination path required"),
    overwrite: zod_1.z.boolean().optional().default(false),
});
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const BACKUP_DIR = ".file-editor-backups";
/**
 * Read file contents with optional line range
 */
async function readFile(input, workspaceRoot) {
    const absolutePath = path_1.default.resolve(workspaceRoot, input.path);
    // Check file exists
    const stats = await promises_1.default.stat(absolutePath);
    if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${input.path}`);
    }
    // Check file size
    if (stats.size > MAX_FILE_SIZE) {
        throw new Error(`File too large: ${stats.size} bytes (max: ${MAX_FILE_SIZE})`);
    }
    // Read file
    const content = await promises_1.default.readFile(absolutePath, "utf-8");
    const lines = content.split("\n");
    // Apply line range if specified
    if (input.startLine !== undefined || input.endLine !== undefined) {
        const start = (input.startLine ?? 1) - 1; // Convert to 0-indexed
        const end = input.endLine ?? lines.length;
        if (start < 0 || start >= lines.length) {
            throw new Error(`Start line ${input.startLine} out of range (1-${lines.length})`);
        }
        if (end > lines.length) {
            throw new Error(`End line ${input.endLine} out of range (1-${lines.length})`);
        }
        if (start >= end) {
            throw new Error(`Start line must be less than end line`);
        }
        const selectedLines = lines.slice(start, end);
        return {
            content: selectedLines.join("\n"),
            lines: selectedLines.length,
        };
    }
    return {
        content,
        lines: lines.length,
    };
}
/**
 * Write content to file with optional backup
 */
async function writeFile(input, workspaceRoot) {
    const absolutePath = path_1.default.resolve(workspaceRoot, input.path);
    const dir = path_1.default.dirname(absolutePath);
    // Ensure directory exists
    await promises_1.default.mkdir(dir, { recursive: true });
    let backupPath;
    // Create backup if file exists and backup requested
    if (input.createBackup && fs_1.default.existsSync(absolutePath)) {
        const backupDir = path_1.default.join(workspaceRoot, BACKUP_DIR);
        await promises_1.default.mkdir(backupDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const basename = path_1.default.basename(absolutePath);
        backupPath = path_1.default.join(backupDir, `${basename}.${timestamp}.backup`);
        await promises_1.default.copyFile(absolutePath, backupPath);
    }
    // Write file
    let finalContent = input.content;
    if (input.mode === "append" && fs_1.default.existsSync(absolutePath)) {
        const existing = await promises_1.default.readFile(absolutePath, "utf-8");
        finalContent = existing + input.content;
    }
    await promises_1.default.writeFile(absolutePath, finalContent, "utf-8");
    const stats = await promises_1.default.stat(absolutePath);
    return {
        bytesWritten: stats.size,
        backup: backupPath,
    };
}
/**
 * Search for pattern in files
 */
async function searchFiles(input, workspaceRoot) {
    const searchDir = input.directory ? path_1.default.resolve(workspaceRoot, input.directory) : workspaceRoot;
    const results = [];
    const pattern = input.caseSensitive ? input.pattern : input.pattern.toLowerCase();
    async function searchInDirectory(dir) {
        const entries = await promises_1.default.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path_1.default.join(dir, entry.name);
            if (entry.isDirectory()) {
                // Skip hidden directories and node_modules
                if (entry.name.startsWith(".") || entry.name === "node_modules")
                    continue;
                await searchInDirectory(fullPath);
            }
            else if (entry.isFile()) {
                // Filter by extension if specified
                if (input.fileExtensions && input.fileExtensions.length > 0) {
                    const ext = path_1.default.extname(entry.name);
                    if (!input.fileExtensions.includes(ext))
                        continue;
                }
                // Search in file
                const relativePath = path_1.default.relative(workspaceRoot, fullPath);
                await searchInFile(fullPath, relativePath, pattern, input.caseSensitive ?? false);
                if (results.length >= input.maxResults)
                    return;
            }
        }
    }
    async function searchInFile(filePath, relativePath, searchPattern, caseSensitive) {
        try {
            const stats = await promises_1.default.stat(filePath);
            if (stats.size > MAX_FILE_SIZE)
                return; // Skip large files
            const content = await promises_1.default.readFile(filePath, "utf-8");
            const lines = content.split("\n");
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const searchLine = caseSensitive ? line : line.toLowerCase();
                const index = searchLine.indexOf(searchPattern);
                if (index !== -1) {
                    results.push({
                        file: relativePath,
                        line: i + 1, // 1-indexed
                        column: index + 1, // 1-indexed
                        text: line.trim(),
                        context: {
                            before: lines.slice(Math.max(0, i - 2), i).map((l) => l.trim()),
                            after: lines.slice(i + 1, Math.min(lines.length, i + 3)).map((l) => l.trim()),
                        },
                    });
                    if (results.length >= input.maxResults)
                        return;
                }
            }
        }
        catch {
            // Skip files that can't be read
        }
    }
    await searchInDirectory(searchDir);
    return results;
}
/**
 * List directory contents
 */
async function listDirectory(input, workspaceRoot) {
    const absolutePath = path_1.default.resolve(workspaceRoot, input.path);
    const stats = await promises_1.default.stat(absolutePath);
    if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${input.path}`);
    }
    const results = [];
    async function listRecursive(dir) {
        const entries = await promises_1.default.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            // Skip hidden files/directories unless includeHidden is true
            if (!input.includeHidden && entry.name.startsWith("."))
                continue;
            const fullPath = path_1.default.join(dir, entry.name);
            const stats = await promises_1.default.stat(fullPath);
            const relativePath = path_1.default.relative(workspaceRoot, fullPath);
            results.push({
                path: relativePath,
                name: entry.name,
                size: stats.size,
                isDirectory: entry.isDirectory(),
                isFile: entry.isFile(),
                created: stats.birthtime.toISOString(),
                modified: stats.mtime.toISOString(),
                extension: entry.isFile() ? path_1.default.extname(entry.name) : undefined,
            });
            if (input.recursive && entry.isDirectory()) {
                await listRecursive(fullPath);
            }
        }
    }
    await listRecursive(absolutePath);
    return results;
}
/**
 * Delete file with optional backup
 */
async function deleteFile(input, workspaceRoot) {
    const absolutePath = path_1.default.resolve(workspaceRoot, input.path);
    // Check file exists
    const stats = await promises_1.default.stat(absolutePath);
    if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${input.path}`);
    }
    let backupPath;
    // Create backup if requested
    if (input.createBackup) {
        const backupDir = path_1.default.join(workspaceRoot, BACKUP_DIR);
        await promises_1.default.mkdir(backupDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const basename = path_1.default.basename(absolutePath);
        backupPath = path_1.default.join(backupDir, `${basename}.${timestamp}.backup`);
        await promises_1.default.copyFile(absolutePath, backupPath);
    }
    // Delete file
    await promises_1.default.unlink(absolutePath);
    return {
        deleted: true,
        backup: backupPath,
    };
}
/**
 * Move/rename file
 */
async function moveFile(input, workspaceRoot) {
    const sourcePath = path_1.default.resolve(workspaceRoot, input.source);
    const destPath = path_1.default.resolve(workspaceRoot, input.destination);
    // Check source exists
    await promises_1.default.stat(sourcePath);
    // Check if destination exists
    if (fs_1.default.existsSync(destPath) && !input.overwrite) {
        throw new Error(`Destination already exists: ${input.destination}`);
    }
    // Ensure destination directory exists
    const destDir = path_1.default.dirname(destPath);
    await promises_1.default.mkdir(destDir, { recursive: true });
    // Move file
    await promises_1.default.rename(sourcePath, destPath);
    return {
        moved: true,
    };
}
//# sourceMappingURL=file-editor.js.map