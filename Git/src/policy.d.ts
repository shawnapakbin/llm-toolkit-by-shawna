/**
 * Validate repository path exists and is a Git repo
 */
export declare function validateRepoPath(repoPath: string): {
  valid: boolean;
  error?: string;
};
/**
 * Check if branch name is safe
 */
export declare function isSafeBranchName(name: string): {
  safe: boolean;
  reason?: string;
};
/**
 * Check if force push is allowed
 */
export declare function canForcePush(branch: string): {
  allowed: boolean;
  reason?: string;
};
/**
 * Check if hard reset is allowed
 */
export declare function canHardReset(): {
  allowed: boolean;
  warning?: string;
};
/**
 * Validate commit message quality
 */
export declare function validateCommitMessage(message: string): {
  valid: boolean;
  error?: string;
};
/**
 * Validate clone URL is safe
 */
export declare function validateCloneUrl(url: string): {
  safe: boolean;
  reason?: string;
};
/**
 * Check if force delete is safe
 */
export declare function canForceDeleteBranch(branch: string): {
  allowed: boolean;
  reason?: string;
};
/**
 * Get workspace root for Git operations
 */
export declare function getGitWorkspaceRoot(): string;
/**
 * Check if amend is safe (warn if on protected branch)
 */
export declare function canAmendCommit(branch: string): {
  allowed: boolean;
  warning?: string;
};
//# sourceMappingURL=policy.d.ts.map
