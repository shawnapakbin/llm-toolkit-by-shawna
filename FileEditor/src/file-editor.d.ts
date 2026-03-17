import { z } from "zod";
export type ReadFileInput = z.infer<typeof ReadFileSchema>;
export type WriteFileInput = z.infer<typeof WriteFileSchema>;
export type SearchFilesInput = z.infer<typeof SearchFilesSchema>;
export type ListDirectoryInput = z.infer<typeof ListDirectorySchema>;
export type DeleteFileInput = z.infer<typeof DeleteFileSchema>;
export type MoveFileInput = z.infer<typeof MoveFileSchema>;
export declare const ReadFileSchema: z.ZodObject<{
    path: z.ZodString;
    startLine: z.ZodOptional<z.ZodNumber>;
    endLine: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    path: string;
    startLine?: number | undefined;
    endLine?: number | undefined;
}, {
    path: string;
    startLine?: number | undefined;
    endLine?: number | undefined;
}>;
export declare const WriteFileSchema: z.ZodObject<{
    path: z.ZodString;
    content: z.ZodString;
    createBackup: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    mode: z.ZodDefault<z.ZodOptional<z.ZodEnum<["overwrite", "append"]>>>;
}, "strip", z.ZodTypeAny, {
    path: string;
    content: string;
    createBackup: boolean;
    mode: "overwrite" | "append";
}, {
    path: string;
    content: string;
    createBackup?: boolean | undefined;
    mode?: "overwrite" | "append" | undefined;
}>;
export declare const SearchFilesSchema: z.ZodObject<{
    pattern: z.ZodString;
    directory: z.ZodOptional<z.ZodString>;
    fileExtensions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    maxResults: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    caseSensitive: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    pattern: string;
    maxResults: number;
    caseSensitive: boolean;
    directory?: string | undefined;
    fileExtensions?: string[] | undefined;
}, {
    pattern: string;
    directory?: string | undefined;
    fileExtensions?: string[] | undefined;
    maxResults?: number | undefined;
    caseSensitive?: boolean | undefined;
}>;
export declare const ListDirectorySchema: z.ZodObject<{
    path: z.ZodString;
    recursive: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    includeHidden: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    path: string;
    recursive: boolean;
    includeHidden: boolean;
}, {
    path: string;
    recursive?: boolean | undefined;
    includeHidden?: boolean | undefined;
}>;
export declare const DeleteFileSchema: z.ZodObject<{
    path: z.ZodString;
    createBackup: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    path: string;
    createBackup: boolean;
}, {
    path: string;
    createBackup?: boolean | undefined;
}>;
export declare const MoveFileSchema: z.ZodObject<{
    source: z.ZodString;
    destination: z.ZodString;
    overwrite: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    overwrite: boolean;
    source: string;
    destination: string;
}, {
    source: string;
    destination: string;
    overwrite?: boolean | undefined;
}>;
export type FileInfo = {
    path: string;
    name: string;
    size: number;
    isDirectory: boolean;
    isFile: boolean;
    created: string;
    modified: string;
    extension?: string;
};
export type SearchResult = {
    file: string;
    line: number;
    column: number;
    text: string;
    context?: {
        before: string[];
        after: string[];
    };
};
/**
 * Read file contents with optional line range
 */
export declare function readFile(input: ReadFileInput, workspaceRoot: string): Promise<{
    content: string;
    lines: number;
}>;
/**
 * Write content to file with optional backup
 */
export declare function writeFile(input: WriteFileInput, workspaceRoot: string): Promise<{
    bytesWritten: number;
    backup?: string;
}>;
/**
 * Search for pattern in files
 */
export declare function searchFiles(input: SearchFilesInput, workspaceRoot: string): Promise<SearchResult[]>;
/**
 * List directory contents
 */
export declare function listDirectory(input: ListDirectoryInput, workspaceRoot: string): Promise<FileInfo[]>;
/**
 * Delete file with optional backup
 */
export declare function deleteFile(input: DeleteFileInput, workspaceRoot: string): Promise<{
    deleted: boolean;
    backup?: string;
}>;
/**
 * Move/rename file
 */
export declare function moveFile(input: MoveFileInput, workspaceRoot: string): Promise<{
    moved: boolean;
}>;
//# sourceMappingURL=file-editor.d.ts.map