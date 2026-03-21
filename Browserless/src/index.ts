import path from "path";
import {
  ErrorCode,
  OperationTimer,
  type ToolResponse,
  createErrorResponse,
  createSuccessResponse,
  generateTraceId,
} from "@shared/types";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { getRegistry } from "../../Observability/src/metrics";
import {
  type BrowserlessConfig,
  downloadFile,
  executeBQL,
  executeFunction,
  exportPage,
  generatePDF,
  getContent,
  performanceLighthouse,
  scrapePage,
  takeScreenshot,
  unblockPage,
} from "./browserless";
import {
  DEFAULT_TIMEOUT_MS,
  hasUnsafeCodePatterns,
  isCodeTooLong,
  isValidApiKey,
  validateConcurrencyLimit,
  validateTargetUrl,
  validateTimeout,
} from "./policy";

// Load .env from the tool root regardless of launch cwd, then merge process env.
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

// Setup observability metrics
const metrics = getRegistry();
const executionCounter = metrics.counter(
  "browserless_requests_total",
  "Total Browserless API requests",
);
const durationHistogram = metrics.histogram(
  "browserless_request_duration_ms",
  "Browserless request duration in milliseconds",
);

const app = express();
const PORT = Number(process.env.PORT) || 3003;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const DEFAULT_REGION = process.env.BROWSERLESS_DEFAULT_REGION || "production-sfo";
const CONFIGURED_TIMEOUT_MS = Number(
  process.env.BROWSERLESS_DEFAULT_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS,
);
const CONCURRENCY_LIMIT = validateConcurrencyLimit(
  Number(process.env.BROWSERLESS_CONCURRENCY_LIMIT),
);

// Concurrency queue system
let activeRequests = 0;

async function executeWithConcurrencyLimit<T>(fn: () => Promise<T>): Promise<T> {
  while (activeRequests >= CONCURRENCY_LIMIT) {
    // Wait 50ms before checking again
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  activeRequests++;
  try {
    return await fn();
  } finally {
    activeRequests--;
  }
}

function getConfig(apiKey?: string, region?: string, timeoutMs?: number): BrowserlessConfig {
  const fromInput = apiKey?.trim();
  const fromEnv = process.env.BROWSERLESS_API_KEY?.trim();
  // Alias supports MCP/host env blocks that may use token naming.
  const fromEnvAlias = process.env.BROWSERLESS_API_TOKEN?.trim();
  const effectiveApiKey = fromInput || fromEnv || fromEnvAlias || "";

  if (!isValidApiKey(effectiveApiKey)) {
    throw new Error(
      "Browserless API key is required and must be at least 10 characters. Provide apiKey in request body, BROWSERLESS_API_KEY in .env, or BROWSERLESS_API_KEY/BROWSERLESS_API_TOKEN in mcp.json env.",
    );
  }

  return {
    apiKey: effectiveApiKey,
    region: (region || DEFAULT_REGION) as BrowserlessConfig["region"],
    timeoutMs: validateTimeout(timeoutMs || CONFIGURED_TIMEOUT_MS),
  };
}

function hasConfiguredApiKey(): boolean {
  return Boolean(
    process.env.BROWSERLESS_API_KEY?.trim() || process.env.BROWSERLESS_API_TOKEN?.trim(),
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Helper to wrap responses with timing and traceId
function wrapResponse(
  result: { success: boolean; error?: string },
  timingMs: number,
  traceId: string,
): Record<string, unknown> {
  // Record metrics
  if (!result.success) {
    executionCounter.inc({ status: "error", errorCode: ErrorCode.EXECUTION_FAILED });
  } else {
    executionCounter.inc({ status: "success" });
    durationHistogram.observe(timingMs);
  }

  const response: ToolResponse = result.success
    ? createSuccessResponse(result, timingMs, traceId)
    : {
        success: false,
        errorCode: ErrorCode.EXECUTION_FAILED,
        errorMessage: result.error || "Operation failed",
        data: result,
        timingMs,
        traceId,
      };

  const responseData =
    response.data && typeof response.data === "object"
      ? (response.data as Record<string, unknown>)
      : {};

  // Backward compatibility: expose data fields at root + keep "error" field
  return {
    ...response,
    ...responseData,
    error: response.errorMessage,
  };
}

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "browserless-tool" });
});

// Screenshot endpoint
app.post("/screenshot", async (req, res) => {
  return executeWithConcurrencyLimit(async () => {
    const timer = new OperationTimer();
    const traceId = generateTraceId();

    try {
      const urlValidation = validateTargetUrl(req.body.url);
      if (!urlValidation.valid) {
        const timingMs = timer.elapsed();
        executionCounter.inc({ status: "error", errorCode: ErrorCode.INVALID_INPUT });
        const errorResponse = createErrorResponse(
          ErrorCode.INVALID_INPUT,
          urlValidation.error || "Invalid URL",
          timingMs,
          traceId,
        );
        res.status(400).json({ ...errorResponse, error: errorResponse.errorMessage });
        return;
      }

      const config = getConfig(req.body.apiKey, req.body.region, req.body.timeoutMs);
      const result = await takeScreenshot(config, req.body);
      res.json(wrapResponse(result, timer.elapsed(), traceId));
    } catch (error: unknown) {
      const timingMs = timer.elapsed();
      executionCounter.inc({ status: "error", errorCode: ErrorCode.EXECUTION_FAILED });
      const errorResponse = createErrorResponse(
        ErrorCode.EXECUTION_FAILED,
        getErrorMessage(error),
        timingMs,
        traceId,
      );
      res.status(500).json({ ...errorResponse, error: errorResponse.errorMessage });
    }
  });
});

// PDF endpoint
app.post("/pdf", async (req, res) => {
  return executeWithConcurrencyLimit(async () => {
    const timer = new OperationTimer();
    const traceId = generateTraceId();

    try {
      const urlValidation = validateTargetUrl(req.body.url);
      if (!urlValidation.valid) {
        const timingMs = timer.elapsed();
        executionCounter.inc({ status: "error", errorCode: ErrorCode.INVALID_INPUT });
        const errorResponse = createErrorResponse(
          ErrorCode.INVALID_INPUT,
          urlValidation.error || "Invalid URL",
          timingMs,
          traceId,
        );
        res.status(400).json({ ...errorResponse, error: errorResponse.errorMessage });
        return;
      }

      const config = getConfig(req.body.apiKey, req.body.region, req.body.timeoutMs);
      const result = await generatePDF(config, req.body);
      res.json(wrapResponse(result, timer.elapsed(), traceId));
    } catch (error: unknown) {
      const timingMs = timer.elapsed();
      executionCounter.inc({ status: "error", errorCode: ErrorCode.EXECUTION_FAILED });
      const errorResponse = createErrorResponse(
        ErrorCode.EXECUTION_FAILED,
        getErrorMessage(error),
        timingMs,
        traceId,
      );
      res.status(500).json({ ...errorResponse, error: errorResponse.errorMessage });
    }
  });
});

// Scrape endpoint
app.post("/scrape", async (req, res) => {
  return executeWithConcurrencyLimit(async () => {
    const timer = new OperationTimer();
    const traceId = generateTraceId();

    try {
      const urlValidation = validateTargetUrl(req.body.url);
      if (!urlValidation.valid) {
        const timingMs = timer.elapsed();
        executionCounter.inc({ status: "error", errorCode: ErrorCode.INVALID_INPUT });
        const errorResponse = createErrorResponse(
          ErrorCode.INVALID_INPUT,
          urlValidation.error || "Invalid URL",
          timingMs,
          traceId,
        );
        res.status(400).json({ ...errorResponse, error: errorResponse.errorMessage });
        return;
      }

      const config = getConfig(req.body.apiKey, req.body.region, req.body.timeoutMs);
      const result = await scrapePage(config, req.body);
      res.json(wrapResponse(result, timer.elapsed(), traceId));
    } catch (error: unknown) {
      const timingMs = timer.elapsed();
      executionCounter.inc({ status: "error", errorCode: ErrorCode.EXECUTION_FAILED });
      const errorResponse = createErrorResponse(
        ErrorCode.EXECUTION_FAILED,
        getErrorMessage(error),
        timingMs,
        traceId,
      );
      res.status(500).json({ ...errorResponse, error: errorResponse.errorMessage });
    }
  });
});

// Content endpoint
app.post("/content", async (req, res) => {
  return executeWithConcurrencyLimit(async () => {
    const timer = new OperationTimer();
    const traceId = generateTraceId();

    try {
      const urlValidation = validateTargetUrl(req.body.url);
      if (!urlValidation.valid) {
        const timingMs = timer.elapsed();
        executionCounter.inc({ status: "error", errorCode: ErrorCode.INVALID_INPUT });
        const errorResponse = createErrorResponse(
          ErrorCode.INVALID_INPUT,
          urlValidation.error || "Invalid URL",
          timingMs,
          traceId,
        );
        res.status(400).json({ ...errorResponse, error: errorResponse.errorMessage });
        return;
      }

      const config = getConfig(req.body.apiKey, req.body.region, req.body.timeoutMs);
      const result = await getContent(config, req.body);
      res.json(wrapResponse(result, timer.elapsed(), traceId));
    } catch (error: unknown) {
      const timingMs = timer.elapsed();
      executionCounter.inc({ status: "error", errorCode: ErrorCode.EXECUTION_FAILED });
      const errorResponse = createErrorResponse(
        ErrorCode.EXECUTION_FAILED,
        getErrorMessage(error),
        timingMs,
        traceId,
      );
      res.status(500).json({ ...errorResponse, error: errorResponse.errorMessage });
    }
  });
});

// Unblock endpoint
app.post("/unblock", async (req, res) => {
  return executeWithConcurrencyLimit(async () => {
    const timer = new OperationTimer();
    const traceId = generateTraceId();

    try {
      const urlValidation = validateTargetUrl(req.body.url);
      if (!urlValidation.valid) {
        const timingMs = timer.elapsed();
        executionCounter.inc({ status: "error", errorCode: ErrorCode.INVALID_INPUT });
        const errorResponse = createErrorResponse(
          ErrorCode.INVALID_INPUT,
          urlValidation.error || "Invalid URL",
          timingMs,
          traceId,
        );
        res.status(400).json({ ...errorResponse, error: errorResponse.errorMessage });
        return;
      }

      const config = getConfig(req.body.apiKey, req.body.region, req.body.timeoutMs);
      const result = await unblockPage(config, req.body);
      res.json(wrapResponse(result, timer.elapsed(), traceId));
    } catch (error: unknown) {
      const timingMs = timer.elapsed();
      executionCounter.inc({ status: "error", errorCode: ErrorCode.EXECUTION_FAILED });
      const errorResponse = createErrorResponse(
        ErrorCode.EXECUTION_FAILED,
        getErrorMessage(error),
        timingMs,
        traceId,
      );
      res.status(500).json({ ...errorResponse, error: errorResponse.errorMessage });
    }
  });
});

// BQL endpoint
app.post("/bql", async (req, res) => {
  return executeWithConcurrencyLimit(async () => {
    const timer = new OperationTimer();
    const traceId = generateTraceId();

    try {
      const config = getConfig(req.body.apiKey, req.body.region, req.body.timeoutMs);
      const result = await executeBQL(config, {
        query: req.body.query,
        variables: req.body.variables,
        operationName: req.body.operationName,
        replay: req.body.replay !== false, // Default to true for session recording
      });
      res.json(wrapResponse(result, timer.elapsed(), traceId));
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(
        ErrorCode.EXECUTION_FAILED,
        getErrorMessage(error),
        timer.elapsed(),
        traceId,
      );
      res.status(500).json({ ...errorResponse, error: errorResponse.errorMessage });
    }
  });
});

// Function endpoint - execute custom Puppeteer code
app.post("/function", async (req, res) => {
  return executeWithConcurrencyLimit(async () => {
    const timer = new OperationTimer();
    const traceId = generateTraceId();

    try {
      const code = req.body.code;

      if (!code || typeof code !== "string") {
        const errorResponse = createErrorResponse(
          ErrorCode.INVALID_INPUT,
          "Code is required and must be a string",
          timer.elapsed(),
          traceId,
        );
        res.status(400).json({ ...errorResponse, error: errorResponse.errorMessage });
        return;
      }

      if (isCodeTooLong(code)) {
        const errorResponse = createErrorResponse(
          ErrorCode.INVALID_INPUT,
          "Code is too long. Maximum 10000 characters allowed.",
          timer.elapsed(),
          traceId,
        );
        res.status(400).json({ ...errorResponse, error: errorResponse.errorMessage });
        return;
      }

      if (hasUnsafeCodePatterns(code)) {
        const errorResponse = createErrorResponse(
          ErrorCode.POLICY_BLOCKED,
          "Code contains potentially unsafe patterns",
          timer.elapsed(),
          traceId,
        );
        res.status(403).json({ ...errorResponse, error: errorResponse.errorMessage });
        return;
      }

      const config = getConfig(req.body.apiKey, req.body.region, req.body.timeoutMs);
      const result = await executeFunction(config, {
        code: req.body.code,
        context: req.body.context,
        timeout: req.body.timeoutMs,
      });
      res.json(wrapResponse(result, timer.elapsed(), traceId));
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(
        ErrorCode.EXECUTION_FAILED,
        getErrorMessage(error),
        timer.elapsed(),
        traceId,
      );
      res.status(500).json({ ...errorResponse, error: errorResponse.errorMessage });
    }
  });
});

// Download endpoint - retrieve files that Chrome downloads
app.post("/download", async (req, res) => {
  return executeWithConcurrencyLimit(async () => {
    const timer = new OperationTimer();
    const traceId = generateTraceId();

    try {
      const config = getConfig(req.body.apiKey, req.body.region, req.body.timeoutMs);
      const result = await downloadFile(config, {
        code: req.body.code,
        context: req.body.context,
        timeout: req.body.timeoutMs,
      });
      res.json(wrapResponse(result, timer.elapsed(), traceId));
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(
        ErrorCode.EXECUTION_FAILED,
        getErrorMessage(error),
        timer.elapsed(),
        traceId,
      );
      res.status(500).json({ ...errorResponse, error: errorResponse.errorMessage });
    }
  });
});

// Export endpoint - fetch URL and stream content
app.post("/export", async (req, res) => {
  return executeWithConcurrencyLimit(async () => {
    const timer = new OperationTimer();
    const traceId = generateTraceId();

    try {
      const urlValidation = validateTargetUrl(req.body.url);
      if (!urlValidation.valid) {
        const errorResponse = createErrorResponse(
          ErrorCode.INVALID_INPUT,
          urlValidation.error || "Invalid URL",
          timer.elapsed(),
          traceId,
        );
        res.status(400).json({ ...errorResponse, error: errorResponse.errorMessage });
        return;
      }

      const config = getConfig(req.body.apiKey, req.body.region, req.body.timeoutMs);
      const result = await exportPage(config, {
        url: req.body.url,
        includeResources: req.body.includeResources ?? false,
        timeout: req.body.timeoutMs,
      });
      res.json(wrapResponse(result, timer.elapsed(), traceId));
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(
        ErrorCode.EXECUTION_FAILED,
        getErrorMessage(error),
        timer.elapsed(),
        traceId,
      );
      res.status(500).json({ ...errorResponse, error: errorResponse.errorMessage });
    }
  });
});

// Performance endpoint - Lighthouse audits
app.post("/performance", async (req, res) => {
  return executeWithConcurrencyLimit(async () => {
    const timer = new OperationTimer();
    const traceId = generateTraceId();

    try {
      const urlValidation = validateTargetUrl(req.body.url);
      if (!urlValidation.valid) {
        const errorResponse = createErrorResponse(
          ErrorCode.INVALID_INPUT,
          urlValidation.error || "Invalid URL",
          timer.elapsed(),
          traceId,
        );
        res.status(400).json({ ...errorResponse, error: errorResponse.errorMessage });
        return;
      }

      const config = getConfig(req.body.apiKey, req.body.region, req.body.timeoutMs);
      const result = await performanceLighthouse(config, {
        url: req.body.url,
        config: req.body.config,
        timeout: req.body.timeoutMs,
      });
      res.json(wrapResponse(result, timer.elapsed(), traceId));
    } catch (error: unknown) {
      const errorResponse = createErrorResponse(
        ErrorCode.EXECUTION_FAILED,
        getErrorMessage(error),
        timer.elapsed(),
        traceId,
      );
      res.status(500).json({ ...errorResponse, error: errorResponse.errorMessage });
    }
  });
});

// Export app for testing
export { app };

// Only start server if this is the main module
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Browserless tool server running on http://localhost:${PORT}`);

    if (!hasConfiguredApiKey()) {
      console.warn(
        "WARNING: BROWSERLESS_API_KEY/BROWSERLESS_API_TOKEN not set in environment. API key must be provided with each request.",
      );
    }
  });
}
