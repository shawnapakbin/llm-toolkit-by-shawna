"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const file_editor_1 = require("./file-editor");
const policy_1 = require("./policy");
const types_1 = require("@shared/types");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT) || 3010;
const WORKSPACE_ROOT = (0, policy_1.getWorkspaceRoot)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
console.log(`🗂️  FileEditor workspace: ${WORKSPACE_ROOT}`);
// Health check
app.get("/health", (_, res) => {
    res.json({ status: "healthy", workspace: WORKSPACE_ROOT });
});
// Read file
app.post("/tools/read_file", async (req, res) => {
    const traceId = (0, types_1.generateTraceId)();
    const start = Date.now();
    try {
        const input = file_editor_1.ReadFileSchema.parse(req.body);
        // Validate path
        const pathCheck = (0, policy_1.validatePath)(input.path, WORKSPACE_ROOT);
        if (!pathCheck.valid) {
            return res.json((0, types_1.createErrorResponse)(types_1.ErrorCode.POLICY_BLOCKED, pathCheck.error, Date.now() - start, traceId));
        }
        const blockedCheck = (0, policy_1.isBlockedPath)(input.path);
        if (blockedCheck.blocked) {
            return res.json((0, types_1.createErrorResponse)(types_1.ErrorCode.POLICY_BLOCKED, blockedCheck.reason, Date.now() - start, traceId));
        }
        const result = await (0, file_editor_1.readFile)(input, WORKSPACE_ROOT);
        res.json((0, types_1.createSuccessResponse)(result, Date.now() - start, traceId));
    }
    catch (error) {
        if (error.name === "ZodError") {
            return res.json((0, types_1.createErrorResponse)(types_1.ErrorCode.INVALID_INPUT, error.errors[0].message, Date.now() - start, traceId));
        }
        res.json((0, types_1.createErrorResponse)(types_1.ErrorCode.EXECUTION_FAILED, error.message, Date.now() - start, traceId));
    }
});
// Write file
app.post("/tools/write_file", async (req, res) => {
    const traceId = (0, types_1.generateTraceId)();
    const start = Date.now();
    try {
        const input = file_editor_1.WriteFileSchema.parse(req.body);
        // Validate path
        const pathCheck = (0, policy_1.validatePath)(input.path, WORKSPACE_ROOT);
        if (!pathCheck.valid) {
            return res.json((0, types_1.createErrorResponse)(types_1.ErrorCode.POLICY_BLOCKED, pathCheck.error, Date.now() - start, traceId));
        }
        const blockedCheck = (0, policy_1.isBlockedPath)(input.path);
        if (blockedCheck.blocked) {
            return res.json((0, types_1.createErrorResponse)(types_1.ErrorCode.POLICY_BLOCKED, blockedCheck.reason, Date.now() - start, traceId));
        }
        const extCheck = (0, policy_1.isAllowedExtensionForWrite)(input.path);
        if (!extCheck.allowed) {
            return res.json((0, types_1.createErrorResponse)(types_1.ErrorCode.POLICY_BLOCKED, extCheck.reason, Date.now() - start, traceId));
        }
        const contentCheck = (0, policy_1.validateContentSafety)(input.content);
        if (!contentCheck.safe) {
            return res.json((0, types_1.createErrorResponse)(types_1.ErrorCode.POLICY_BLOCKED, contentCheck.reason, Date.now() - start, traceId));
        }
        const result = await (0, file_editor_1.writeFile)(input, WORKSPACE_ROOT);
        res.json((0, types_1.createSuccessResponse)(result, Date.now() - start, traceId));
    }
    catch (error) {
        if (error.name === "ZodError") {
            return res.json((0, types_1.createErrorResponse)(types_1.ErrorCode.INVALID_INPUT, error.errors[0].message, Date.now() - start, traceId));
        }
        res.json((0, types_1.createErrorResponse)(types_1.ErrorCode.EXECUTION_FAILED, error.message, Date.now() - start, traceId));
    }
});
// Search files
app.post("/tools/search_files", async (req, res) => {
    const traceId = (0, types_1.generateTraceId)();
    const start = Date.now();
    try {
        const input = file_editor_1.SearchFilesSchema.parse(req.body);
        const result = await (0, file_editor_1.searchFiles)(input, WORKSPACE_ROOT);
        res.json((0, types_1.createSuccessResponse)({ results: result, count: result.length }, Date.now() - start, traceId));
    }
    catch (error) {
        if (error.name === "ZodError") {
            return res.json((0, types_1.createErrorResponse)(types_1.ErrorCode.INVALID_INPUT, error.errors[0].message, Date.now() - start, traceId));
        }
        return res.json((0, types_1.createErrorResponse)(types_1.ErrorCode.EXECUTION_FAILED, error.message, Date.now() - start, traceId));
    }
});
// List directory
app.post("/tools/list_directory", async (req, res) => {
    const traceId = (0, types_1.generateTraceId)();
    const start = Date.now();
    try {
        const input = file_editor_1.ListDirectorySchema.parse(req.body);
        const pathCheck = (0, policy_1.validatePath)(input.path, WORKSPACE_ROOT);
        if (!pathCheck.valid) {
            return res.json((0, types_1.createErrorResponse)(types_1.ErrorCode.POLICY_BLOCKED, pathCheck.error, Date.now() - start, traceId));
        }
        const result = await (0, file_editor_1.listDirectory)(input, WORKSPACE_ROOT);
        res.json((0, types_1.createSuccessResponse)({ files: result, count: result.length }, Date.now() - start, traceId));
    }
    catch (error) {
        if (error.name === "ZodError") {
            return res.json((0, types_1.createErrorResponse)(types_1.ErrorCode.INVALID_INPUT, error.errors[0].message, Date.now() - start, traceId));
        }
        return res.json((0, types_1.createErrorResponse)(types_1.ErrorCode.EXECUTION_FAILED, error.message, Date.now() - start, traceId));
    }
});
// Delete file
app.post("/tools/delete_file", async (req, res) => {
    const traceId = (0, types_1.generateTraceId)();
    const start = Date.now();
    try {
        const input = file_editor_1.DeleteFileSchema.parse(req.body);
        const pathCheck = (0, policy_1.validatePath)(input.path, WORKSPACE_ROOT);
        if (!pathCheck.valid) {
            return res.json((0, types_1.createErrorResponse)(types_1.ErrorCode.POLICY_BLOCKED, pathCheck.error, Date.now() - start, traceId));
        }
        const deleteCheck = (0, policy_1.canDelete)(input.path);
        if (!deleteCheck.allowed) {
            return res.json((0, types_1.createErrorResponse)(types_1.ErrorCode.POLICY_BLOCKED, deleteCheck.reason, Date.now() - start, traceId));
        }
        const result = await (0, file_editor_1.deleteFile)(input, WORKSPACE_ROOT);
        res.json((0, types_1.createSuccessResponse)(result, Date.now() - start, traceId));
    }
    catch (error) {
        if (error.name === "ZodError") {
            return res.json((0, types_1.createErrorResponse)(types_1.ErrorCode.INVALID_INPUT, error.errors[0].message, Date.now() - start, traceId));
        }
        return res.json((0, types_1.createErrorResponse)(types_1.ErrorCode.EXECUTION_FAILED, error.message, Date.now() - start, traceId));
    }
});
// Move file
app.post("/tools/move_file", async (req, res) => {
    const traceId = (0, types_1.generateTraceId)();
    const start = Date.now();
    try {
        const input = file_editor_1.MoveFileSchema.parse(req.body);
        const sourceCheck = (0, policy_1.validatePath)(input.source, WORKSPACE_ROOT);
        if (!sourceCheck.valid) {
            return res.json((0, types_1.createErrorResponse)(types_1.ErrorCode.POLICY_BLOCKED, sourceCheck.error, Date.now() - start, traceId));
        }
        const destCheck = (0, policy_1.validatePath)(input.destination, WORKSPACE_ROOT);
        if (!destCheck.valid) {
            return res.json((0, types_1.createErrorResponse)(types_1.ErrorCode.POLICY_BLOCKED, destCheck.error, Date.now() - start, traceId));
        }
        const result = await (0, file_editor_1.moveFile)(input, WORKSPACE_ROOT);
        res.json((0, types_1.createSuccessResponse)(result, Date.now() - start, traceId));
    }
    catch (error) {
        if (error.name === "ZodError") {
            return res.json((0, types_1.createErrorResponse)(types_1.ErrorCode.INVALID_INPUT, error.errors[0].message, Date.now() - start, traceId));
        }
        res.json((0, types_1.createErrorResponse)(types_1.ErrorCode.EXECUTION_FAILED, error.message, Date.now() - start, traceId));
    }
});
app.listen(PORT, () => {
    console.log(`🚀 FileEditor HTTP server running on port ${PORT}`);
});
//# sourceMappingURL=index.js.map