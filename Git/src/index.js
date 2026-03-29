var __importDefault =
  (this && this.__importDefault) || ((mod) => (mod && mod.__esModule ? mod : { default: mod }));
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const git_1 = require("./git");
const policy_1 = require("./policy");
const types_1 = require("@shared/types");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT) || 3011;
const WORKSPACE_ROOT = (0, policy_1.getGitWorkspaceRoot)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
console.log(`🔧 Git tool workspace: ${WORKSPACE_ROOT}`);
// Health check
app.get("/health", (_, res) => {
  res.json({ status: "healthy", workspace: WORKSPACE_ROOT });
});
// Git status
app.post("/tools/git_status", async (req, res) => {
  const traceId = (0, types_1.generateTraceId)();
  const start = Date.now();
  try {
    const input = git_1.GitStatusSchema.parse(req.body);
    const repoCheck = (0, policy_1.validateRepoPath)(WORKSPACE_ROOT);
    if (!repoCheck.valid) {
      return res.json(
        (0, types_1.createErrorResponse)(
          types_1.ErrorCode.INVALID_INPUT,
          repoCheck.error,
          Date.now() - start,
          traceId,
        ),
      );
    }
    const result = await (0, git_1.gitStatus)(input, WORKSPACE_ROOT);
    res.json((0, types_1.createSuccessResponse)(result, Date.now() - start, traceId));
  } catch (error) {
    if (error.name === "ZodError") {
      return res.json(
        (0, types_1.createErrorResponse)(
          types_1.ErrorCode.INVALID_INPUT,
          error.errors[0].message,
          Date.now() - start,
          traceId,
        ),
      );
    }
    res.json(
      (0, types_1.createErrorResponse)(
        types_1.ErrorCode.EXECUTION_FAILED,
        error.message,
        Date.now() - start,
        traceId,
      ),
    );
  }
});
// Git diff
app.post("/tools/git_diff", async (req, res) => {
  const traceId = (0, types_1.generateTraceId)();
  const start = Date.now();
  try {
    const input = git_1.GitDiffSchema.parse(req.body);
    const repoCheck = (0, policy_1.validateRepoPath)(WORKSPACE_ROOT);
    if (!repoCheck.valid) {
      return res.json(
        (0, types_1.createErrorResponse)(
          types_1.ErrorCode.INVALID_INPUT,
          repoCheck.error,
          Date.now() - start,
          traceId,
        ),
      );
    }
    const result = await (0, git_1.gitDiff)(input, WORKSPACE_ROOT);
    res.json((0, types_1.createSuccessResponse)(result, Date.now() - start, traceId));
  } catch (error) {
    if (error.name === "ZodError") {
      return res.json(
        (0, types_1.createErrorResponse)(
          types_1.ErrorCode.INVALID_INPUT,
          error.errors[0].message,
          Date.now() - start,
          traceId,
        ),
      );
    }
    res.json(
      (0, types_1.createErrorResponse)(
        types_1.ErrorCode.EXECUTION_FAILED,
        error.message,
        Date.now() - start,
        traceId,
      ),
    );
  }
});
// Git log
app.post("/tools/git_log", async (req, res) => {
  const traceId = (0, types_1.generateTraceId)();
  const start = Date.now();
  try {
    const input = git_1.GitLogSchema.parse(req.body);
    const repoCheck = (0, policy_1.validateRepoPath)(WORKSPACE_ROOT);
    if (!repoCheck.valid) {
      return res.json(
        (0, types_1.createErrorResponse)(
          types_1.ErrorCode.INVALID_INPUT,
          repoCheck.error,
          Date.now() - start,
          traceId,
        ),
      );
    }
    const result = await (0, git_1.gitLog)(input, WORKSPACE_ROOT);
    res.json((0, types_1.createSuccessResponse)(result, Date.now() - start, traceId));
  } catch (error) {
    if (error.name === "ZodError") {
      return res.json(
        (0, types_1.createErrorResponse)(
          types_1.ErrorCode.INVALID_INPUT,
          error.errors[0].message,
          Date.now() - start,
          traceId,
        ),
      );
    }
    res.json(
      (0, types_1.createErrorResponse)(
        types_1.ErrorCode.EXECUTION_FAILED,
        error.message,
        Date.now() - start,
        traceId,
      ),
    );
  }
});
// Git branch
app.post("/tools/git_branch", async (req, res) => {
  const traceId = (0, types_1.generateTraceId)();
  const start = Date.now();
  try {
    const input = git_1.GitBranchSchema.parse(req.body);
    const repoCheck = (0, policy_1.validateRepoPath)(WORKSPACE_ROOT);
    if (!repoCheck.valid) {
      return res.json(
        (0, types_1.createErrorResponse)(
          types_1.ErrorCode.INVALID_INPUT,
          repoCheck.error,
          Date.now() - start,
          traceId,
        ),
      );
    }
    // Validate branch name for create/delete
    if (input.name) {
      const nameCheck = (0, policy_1.isSafeBranchName)(input.name);
      if (!nameCheck.safe) {
        return res.json(
          (0, types_1.createErrorResponse)(
            types_1.ErrorCode.POLICY_BLOCKED,
            nameCheck.reason,
            Date.now() - start,
            traceId,
          ),
        );
      }
    }
    // Check force delete policy
    if (input.action === "delete" && input.force && input.name) {
      const forceCheck = (0, policy_1.canForceDeleteBranch)(input.name);
      if (!forceCheck.allowed) {
        return res.json(
          (0, types_1.createErrorResponse)(
            types_1.ErrorCode.POLICY_BLOCKED,
            forceCheck.reason,
            Date.now() - start,
            traceId,
          ),
        );
      }
    }
    const result = await (0, git_1.gitBranch)(input, WORKSPACE_ROOT);
    res.json((0, types_1.createSuccessResponse)(result, Date.now() - start, traceId));
  } catch (error) {
    if (error.name === "ZodError") {
      return res.json(
        (0, types_1.createErrorResponse)(
          types_1.ErrorCode.INVALID_INPUT,
          error.errors[0].message,
          Date.now() - start,
          traceId,
        ),
      );
    }
    res.json(
      (0, types_1.createErrorResponse)(
        types_1.ErrorCode.EXECUTION_FAILED,
        error.message,
        Date.now() - start,
        traceId,
      ),
    );
  }
});
// Git checkout
app.post("/tools/git_checkout", async (req, res) => {
  const traceId = (0, types_1.generateTraceId)();
  const start = Date.now();
  try {
    const input = git_1.GitCheckoutSchema.parse(req.body);
    const repoCheck = (0, policy_1.validateRepoPath)(WORKSPACE_ROOT);
    if (!repoCheck.valid) {
      return res.json(
        (0, types_1.createErrorResponse)(
          types_1.ErrorCode.INVALID_INPUT,
          repoCheck.error,
          Date.now() - start,
          traceId,
        ),
      );
    }
    if (input.createBranch) {
      const nameCheck = (0, policy_1.isSafeBranchName)(input.target);
      if (!nameCheck.safe) {
        return res.json(
          (0, types_1.createErrorResponse)(
            types_1.ErrorCode.POLICY_BLOCKED,
            nameCheck.reason,
            Date.now() - start,
            traceId,
          ),
        );
      }
    }
    const result = await (0, git_1.gitCheckout)(input, WORKSPACE_ROOT);
    res.json((0, types_1.createSuccessResponse)(result, Date.now() - start, traceId));
  } catch (error) {
    if (error.name === "ZodError") {
      return res.json(
        (0, types_1.createErrorResponse)(
          types_1.ErrorCode.INVALID_INPUT,
          error.errors[0].message,
          Date.now() - start,
          traceId,
        ),
      );
    }
    res.json(
      (0, types_1.createErrorResponse)(
        types_1.ErrorCode.EXECUTION_FAILED,
        error.message,
        Date.now() - start,
        traceId,
      ),
    );
  }
});
// Git commit
app.post("/tools/git_commit", async (req, res) => {
  const traceId = (0, types_1.generateTraceId)();
  const start = Date.now();
  try {
    const input = git_1.GitCommitSchema.parse(req.body);
    const repoCheck = (0, policy_1.validateRepoPath)(WORKSPACE_ROOT);
    if (!repoCheck.valid) {
      return res.json(
        (0, types_1.createErrorResponse)(
          types_1.ErrorCode.INVALID_INPUT,
          repoCheck.error,
          Date.now() - start,
          traceId,
        ),
      );
    }
    const messageCheck = (0, policy_1.validateCommitMessage)(input.message);
    if (!messageCheck.valid) {
      return res.json(
        (0, types_1.createErrorResponse)(
          types_1.ErrorCode.POLICY_BLOCKED,
          messageCheck.error,
          Date.now() - start,
          traceId,
        ),
      );
    }
    const result = await (0, git_1.gitCommit)(input, WORKSPACE_ROOT);
    res.json((0, types_1.createSuccessResponse)(result, Date.now() - start, traceId));
  } catch (error) {
    if (error.name === "ZodError") {
      return res.json(
        (0, types_1.createErrorResponse)(
          types_1.ErrorCode.INVALID_INPUT,
          error.errors[0].message,
          Date.now() - start,
          traceId,
        ),
      );
    }
    res.json(
      (0, types_1.createErrorResponse)(
        types_1.ErrorCode.EXECUTION_FAILED,
        error.message,
        Date.now() - start,
        traceId,
      ),
    );
  }
});
// Git push
app.post("/tools/git_push", async (req, res) => {
  const traceId = (0, types_1.generateTraceId)();
  const start = Date.now();
  try {
    const input = git_1.GitPushSchema.parse(req.body);
    const repoCheck = (0, policy_1.validateRepoPath)(WORKSPACE_ROOT);
    if (!repoCheck.valid) {
      return res.json(
        (0, types_1.createErrorResponse)(
          types_1.ErrorCode.INVALID_INPUT,
          repoCheck.error,
          Date.now() - start,
          traceId,
        ),
      );
    }
    if (input.force && input.branch) {
      const forceCheck = (0, policy_1.canForcePush)(input.branch);
      if (!forceCheck.allowed) {
        return res.json(
          (0, types_1.createErrorResponse)(
            types_1.ErrorCode.POLICY_BLOCKED,
            forceCheck.reason,
            Date.now() - start,
            traceId,
          ),
        );
      }
    }
    const result = await (0, git_1.gitPush)(input, WORKSPACE_ROOT);
    res.json((0, types_1.createSuccessResponse)(result, Date.now() - start, traceId));
  } catch (error) {
    if (error.name === "ZodError") {
      return res.json(
        (0, types_1.createErrorResponse)(
          types_1.ErrorCode.INVALID_INPUT,
          error.errors[0].message,
          Date.now() - start,
          traceId,
        ),
      );
    }
    res.json(
      (0, types_1.createErrorResponse)(
        types_1.ErrorCode.EXECUTION_FAILED,
        error.message,
        Date.now() - start,
        traceId,
      ),
    );
  }
});
// Git pull
app.post("/tools/git_pull", async (req, res) => {
  const traceId = (0, types_1.generateTraceId)();
  const start = Date.now();
  try {
    const input = git_1.GitPullSchema.parse(req.body);
    const repoCheck = (0, policy_1.validateRepoPath)(WORKSPACE_ROOT);
    if (!repoCheck.valid) {
      return res.json(
        (0, types_1.createErrorResponse)(
          types_1.ErrorCode.INVALID_INPUT,
          repoCheck.error,
          Date.now() - start,
          traceId,
        ),
      );
    }
    const result = await (0, git_1.gitPull)(input, WORKSPACE_ROOT);
    res.json((0, types_1.createSuccessResponse)(result, Date.now() - start, traceId));
  } catch (error) {
    if (error.name === "ZodError") {
      return res.json(
        (0, types_1.createErrorResponse)(
          types_1.ErrorCode.INVALID_INPUT,
          error.errors[0].message,
          Date.now() - start,
          traceId,
        ),
      );
    }
    res.json(
      (0, types_1.createErrorResponse)(
        types_1.ErrorCode.EXECUTION_FAILED,
        error.message,
        Date.now() - start,
        traceId,
      ),
    );
  }
});
// Git clone
app.post("/tools/git_clone", async (req, res) => {
  const traceId = (0, types_1.generateTraceId)();
  const start = Date.now();
  try {
    const input = git_1.GitCloneSchema.parse(req.body);
    const urlCheck = (0, policy_1.validateCloneUrl)(input.url);
    if (!urlCheck.safe) {
      return res.json(
        (0, types_1.createErrorResponse)(
          types_1.ErrorCode.POLICY_BLOCKED,
          urlCheck.reason,
          Date.now() - start,
          traceId,
        ),
      );
    }
    const result = await (0, git_1.gitClone)(input, WORKSPACE_ROOT);
    res.json((0, types_1.createSuccessResponse)(result, Date.now() - start, traceId));
  } catch (error) {
    if (error.name === "ZodError") {
      return res.json(
        (0, types_1.createErrorResponse)(
          types_1.ErrorCode.INVALID_INPUT,
          error.errors[0].message,
          Date.now() - start,
          traceId,
        ),
      );
    }
    res.json(
      (0, types_1.createErrorResponse)(
        types_1.ErrorCode.EXECUTION_FAILED,
        error.message,
        Date.now() - start,
        traceId,
      ),
    );
  }
});
// Git stash
app.post("/tools/git_stash", async (req, res) => {
  const traceId = (0, types_1.generateTraceId)();
  const start = Date.now();
  try {
    const input = git_1.GitStashSchema.parse(req.body);
    const repoCheck = (0, policy_1.validateRepoPath)(WORKSPACE_ROOT);
    if (!repoCheck.valid) {
      return res.json(
        (0, types_1.createErrorResponse)(
          types_1.ErrorCode.INVALID_INPUT,
          repoCheck.error,
          Date.now() - start,
          traceId,
        ),
      );
    }
    const result = await (0, git_1.gitStash)(input, WORKSPACE_ROOT);
    res.json((0, types_1.createSuccessResponse)(result, Date.now() - start, traceId));
  } catch (error) {
    if (error.name === "ZodError") {
      return res.json(
        (0, types_1.createErrorResponse)(
          types_1.ErrorCode.INVALID_INPUT,
          error.errors[0].message,
          Date.now() - start,
          traceId,
        ),
      );
    }
    res.json(
      (0, types_1.createErrorResponse)(
        types_1.ErrorCode.EXECUTION_FAILED,
        error.message,
        Date.now() - start,
        traceId,
      ),
    );
  }
});
// Git reset
app.post("/tools/git_reset", async (req, res) => {
  const traceId = (0, types_1.generateTraceId)();
  const start = Date.now();
  try {
    const input = git_1.GitResetSchema.parse(req.body);
    const repoCheck = (0, policy_1.validateRepoPath)(WORKSPACE_ROOT);
    if (!repoCheck.valid) {
      return res.json(
        (0, types_1.createErrorResponse)(
          types_1.ErrorCode.INVALID_INPUT,
          repoCheck.error,
          Date.now() - start,
          traceId,
        ),
      );
    }
    if (input.mode === "hard") {
      const resetCheck = (0, policy_1.canHardReset)();
      if (!resetCheck.allowed) {
        return res.json(
          (0, types_1.createErrorResponse)(
            types_1.ErrorCode.POLICY_BLOCKED,
            "Hard reset not allowed",
            Date.now() - start,
            traceId,
          ),
        );
      }
    }
    const result = await (0, git_1.gitReset)(input, WORKSPACE_ROOT);
    res.json((0, types_1.createSuccessResponse)(result, Date.now() - start, traceId));
  } catch (error) {
    if (error.name === "ZodError") {
      return res.json(
        (0, types_1.createErrorResponse)(
          types_1.ErrorCode.INVALID_INPUT,
          error.errors[0].message,
          Date.now() - start,
          traceId,
        ),
      );
    }
    res.json(
      (0, types_1.createErrorResponse)(
        types_1.ErrorCode.EXECUTION_FAILED,
        error.message,
        Date.now() - start,
        traceId,
      ),
    );
  }
});
app.listen(PORT, () => {
  console.log(`🚀 Git HTTP server running on port ${PORT}`);
});
//# sourceMappingURL=index.js.map
