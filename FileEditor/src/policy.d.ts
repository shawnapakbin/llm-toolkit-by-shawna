/**
 * Validate and sanitize file path to prevent directory traversal
 */
export declare function validatePath(filePath: string, workspaceRoot: string): {
    valid: boolean;
    error?: string;
};
/**
 * Check if file path matches deny patterns
 */
export declare function isBlockedPath(filePath: string): {
    blocked: boolean;
    reason?: string;
};
/**
 * Check if file extension is allowed for write operations
 */
export declare function isAllowedExtensionForWrite(filePath: string): {
    allowed: boolean;
    reason?: string;
};
/**
 * Validate maximum file size for read operations
 */
export declare function validateFileSize(size: number, maxSize?: number): {
    valid: boolean;
    error?: string;
};
/**
 * Check if content contains suspicious patterns that might indicate malicious code
 */
export declare function validateContentSafety(content: string): {
    safe: boolean;
    reason?: string;
};
/**
 * Get workspace root from environment or default
 */
export declare function getWorkspaceRoot(): string;
/**
 * Check if delete operation is allowed
 */
export declare function canDelete(filePath: string): {
    allowed: boolean;
    reason?: string;
};
//# sourceMappingURL=policy.d.ts.map