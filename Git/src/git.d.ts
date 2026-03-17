import { z } from "zod";
export type GitStatusInput = z.infer<typeof GitStatusSchema>;
export type GitDiffInput = z.infer<typeof GitDiffSchema>;
export type GitLogInput = z.infer<typeof GitLogSchema>;
export type GitBranchInput = z.infer<typeof GitBranchSchema>;
export type GitCheckoutInput = z.infer<typeof GitCheckoutSchema>;
export type GitCommitInput = z.infer<typeof GitCommitSchema>;
export type GitPushInput = z.infer<typeof GitPushSchema>;
export type GitPullInput = z.infer<typeof GitPullSchema>;
export type GitCloneInput = z.infer<typeof GitCloneSchema>;
export type GitStashInput = z.infer<typeof GitStashSchema>;
export type GitResetInput = z.infer<typeof GitResetSchema>;
export declare const GitStatusSchema: z.ZodObject<{
    short: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    short: boolean;
}, {
    short?: boolean | undefined;
}>;
export declare const GitDiffSchema: z.ZodObject<{
    target: z.ZodOptional<z.ZodString>;
    staged: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    file: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    staged: boolean;
    target?: string | undefined;
    file?: string | undefined;
}, {
    target?: string | undefined;
    staged?: boolean | undefined;
    file?: string | undefined;
}>;
export declare const GitLogSchema: z.ZodObject<{
    maxCount: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    branch: z.ZodOptional<z.ZodString>;
    file: z.ZodOptional<z.ZodString>;
    oneline: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    maxCount: number;
    oneline: boolean;
    file?: string | undefined;
    branch?: string | undefined;
}, {
    file?: string | undefined;
    maxCount?: number | undefined;
    branch?: string | undefined;
    oneline?: boolean | undefined;
}>;
export declare const GitBranchSchema: z.ZodObject<{
    action: z.ZodEnum<["list", "create", "delete"]>;
    name: z.ZodOptional<z.ZodString>;
    force: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    action: "list" | "create" | "delete";
    force: boolean;
    name?: string | undefined;
}, {
    action: "list" | "create" | "delete";
    name?: string | undefined;
    force?: boolean | undefined;
}>;
export declare const GitCheckoutSchema: z.ZodObject<{
    target: z.ZodString;
    createBranch: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    target: string;
    createBranch: boolean;
}, {
    target: string;
    createBranch?: boolean | undefined;
}>;
export declare const GitCommitSchema: z.ZodObject<{
    message: z.ZodString;
    all: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    amend: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    message: string;
    all: boolean;
    amend: boolean;
}, {
    message: string;
    all?: boolean | undefined;
    amend?: boolean | undefined;
}>;
export declare const GitPushSchema: z.ZodObject<{
    remote: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    branch: z.ZodOptional<z.ZodString>;
    force: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    setUpstream: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    force: boolean;
    remote: string;
    setUpstream: boolean;
    branch?: string | undefined;
}, {
    branch?: string | undefined;
    force?: boolean | undefined;
    remote?: string | undefined;
    setUpstream?: boolean | undefined;
}>;
export declare const GitPullSchema: z.ZodObject<{
    remote: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    branch: z.ZodOptional<z.ZodString>;
    rebase: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    remote: string;
    rebase: boolean;
    branch?: string | undefined;
}, {
    branch?: string | undefined;
    remote?: string | undefined;
    rebase?: boolean | undefined;
}>;
export declare const GitCloneSchema: z.ZodObject<{
    url: z.ZodString;
    directory: z.ZodOptional<z.ZodString>;
    branch: z.ZodOptional<z.ZodString>;
    depth: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    url: string;
    branch?: string | undefined;
    directory?: string | undefined;
    depth?: number | undefined;
}, {
    url: string;
    branch?: string | undefined;
    directory?: string | undefined;
    depth?: number | undefined;
}>;
export declare const GitStashSchema: z.ZodObject<{
    action: z.ZodEnum<["save", "pop", "list", "drop"]>;
    message: z.ZodOptional<z.ZodString>;
    index: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    action: "pop" | "list" | "save" | "drop";
    message?: string | undefined;
    index?: number | undefined;
}, {
    action: "pop" | "list" | "save" | "drop";
    message?: string | undefined;
    index?: number | undefined;
}>;
export declare const GitResetSchema: z.ZodObject<{
    mode: z.ZodEnum<["soft", "mixed", "hard"]>;
    target: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    target: string;
    mode: "soft" | "mixed" | "hard";
}, {
    mode: "soft" | "mixed" | "hard";
    target?: string | undefined;
}>;
/**
 * Get repository status
 */
export declare function gitStatus(input: GitStatusInput, repoPath: string): Promise<{
    output: string;
    files: string[];
}>;
/**
 * View diff
 */
export declare function gitDiff(input: GitDiffInput, repoPath: string): Promise<{
    output: string;
    filesChanged: number;
}>;
/**
 * View commit history
 */
export declare function gitLog(input: GitLogInput, repoPath: string): Promise<{
    output: string;
    commits: Array<{
        hash: string;
        message: string;
    }>;
}>;
/**
 * Manage branches
 */
export declare function gitBranch(input: GitBranchInput, repoPath: string): Promise<{
    output: string;
    branches?: string[];
    current?: string;
}>;
/**
 * Checkout branch or commit
 */
export declare function gitCheckout(input: GitCheckoutInput, repoPath: string): Promise<{
    output: string;
    branch: string;
}>;
/**
 * Create commit
 */
export declare function gitCommit(input: GitCommitInput, repoPath: string): Promise<{
    output: string;
    hash: string;
}>;
/**
 * Push to remote
 */
export declare function gitPush(input: GitPushInput, repoPath: string): Promise<{
    output: string;
}>;
/**
 * Pull from remote
 */
export declare function gitPull(input: GitPullInput, repoPath: string): Promise<{
    output: string;
}>;
/**
 * Clone repository
 */
export declare function gitClone(input: GitCloneInput, repoPath: string): Promise<{
    output: string;
    directory: string;
}>;
/**
 * Stash operations
 */
export declare function gitStash(input: GitStashInput, repoPath: string): Promise<{
    output: string;
    stashes?: Array<{
        index: number;
        message: string;
    }>;
}>;
/**
 * Reset repository state
 */
export declare function gitReset(input: GitResetInput, repoPath: string): Promise<{
    output: string;
}>;
//# sourceMappingURL=git.d.ts.map