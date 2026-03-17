import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import {
  takeScreenshot,
  generatePDF,
  scrapePage,
  getContent,
  unblockPage,
  executeBQL,
  executeFunction,
  downloadFile,
  exportPage,
  performanceLighthouse,
  type BrowserlessConfig,
} from "./browserless";
import {
  validateTimeout,
  isValidApiKey,
  validateTargetUrl,
  isCodeTooLong,
  hasUnsafeCodePatterns,
  validateConcurrencyLimit,
  DEFAULT_TIMEOUT_MS,
} from "./policy";
import {
  ToolResponse,
  ErrorCode,
  OperationTimer,
  generateTraceId,
  createSuccessResponse,
  createErrorResponse
} from "@shared/types";
import { getRegistry } from "../../Observability/src/metrics";

dotenv.config();

// Setup observability metrics
const metrics = getRegistry();
const executionCounter = metrics.counter('browserless_requests_total', 'Total Browserless API requests');
const durationHistogram = metrics.histogram('browserless_request_duration_ms', 'Browserless request duration in milliseconds');

const app = express();
const PORT = Number(process.env.PORT) || 3003;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Get API key from environment or request
const BROWSERLESS_API_KEY = process.env.BROWSERLESS_API_KEY || "";
const DEFAULT_REGION = process.env.BROWSERLESS_DEFAULT_REGION || "production-sfo";
const CONFIGURED_TIMEOUT_MS = Number(process.env.BROWSERLESS_DEFAULT_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
const CONCURRENCY_LIMIT = validateConcurrencyLimit(Number(process.env.BROWSERLESS_CONCURRENCY_LIMIT));

// Concurrency queue system
let activeRequests = 0;

async function executeWithConcurrencyLimit<T>(
  fn: () => Promise<T>
): Promise<T> {
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
  const effectiveApiKey = apiKey || BROWSERLESS_API_KEY;
  
  if (!isValidApiKey(effectiveApiKey)) {
    throw new Error("Browserless API key is required and must be at least 10 characters. Provide via BROWSERLESS_API_KEY environment variable or apiKey in request body.");
  }

  return {
    apiKey: effectiveApiKey,
    region: region as any || DEFAULT_REGION,
    timeoutMs: validateTimeout(timeoutMs || CONFIGURED_TIMEOUT_MS),
  };
}

// Helper to wrap responses with timing and traceId
function wrapResponse(result: any, timingMs: number, traceId: string): any {
  // Record metrics
  if (!result.success) {
    executionCounter.inc({ status: 'error', errorCode: ErrorCode.EXECUTION_FAILED });
  } else {
    executionCounter.inc({ status: 'success' });
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
        traceId
      };
  
  // Backward compatibility: expose data fields at root + keep "error" field
  return {
    ...response,
    ...response.data,
    error: response.errorMessage
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
        executionCounter.inc({ status: 'error', errorCode: ErrorCode.INVALID_INPUT });
        const errorResponse = createErrorResponse(
          ErrorCode.INVALID_INPUT,
          urlValidation.error || "Invalid URL",
          timingMs,
          traceId
        );
        res.status(400).json({ ...errorResponse, error: errorResponse.errorMessage });
        return;
      }

      const config = getConfig(req.body.apiKey, req.body.region, req.body.timeoutMs);
      const result = await takeScreenshot(config, req.body);
      res.json(wrapResponse(result, timer.elapsed(), traceId));
    } catch (error: any) {
      const timingMs = timer.elapsed();
      executionCounter.inc({ status: 'error', errorCode: ErrorCode.EXECUTION_FAILED });
      const errorResponse = createErrorResponse(
        ErrorCode.EXECUTION_FAILED,
        error.message,
        timingMs,
        traceId
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
        executionCounter.inc({ status: 'error', errorCode: ErrorCode.INVALID_INPUT });
        const errorResponse = createErrorResponse(
          ErrorCode.INVALID_INPUT,
          urlValidation.error || "Invalid URL",
          timingMs,
          traceId
        );
        res.status(400).json({ ...errorResponse, error: errorResponse.errorMessage });
        return;
      }

      const config = getConfig(req.body.apiKey, req.body.region, req.body.timeoutMs);
      const result = await generatePDF(config, req.body);
      res.json(wrapResponse(result, timer.elapsed(), traceId));
    } catch (error: any) {
      const timingMs = timer.elapsed();
      executionCounter.inc({ status: 'error', errorCode: ErrorCode.EXECUTION_FAILED });
      const errorResponse = createErrorResponse(
        ErrorCode.EXECUTION_FAILED,
        error.message,
        timingMs,
        traceId
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
        executionCounter.inc({ status: 'error', errorCode: ErrorCode.INVALID_INPUT });
        const errorResponse = createErrorResponse(
          ErrorCode.INVALID_INPUT,
          urlValidation.error || "Invalid URL",
          timingMs,
          traceId
        );
        res.status(400).json({ ...errorResponse, error: errorResponse.errorMessage });
        return;
      }

      const config = getConfig(req.body.apiKey, req.body.region, req.body.timeoutMs);
      const result = await scrapePage(config, req.body);
      res.json(wrapResponse(result, timer.elapsed(), traceId));
    } catch (error: any) {
      const timingMs = timer.elapsed();
      executionCounter.inc({ status: 'error', errorCode: ErrorCode.EXECUTION_FAILED });
      const errorResponse = createErrorResponse(
        ErrorCode.EXECUTION_FAILED,
        error.message,
        timingMs,
        traceId
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
        executionCounter.inc({ status: 'error', errorCode: ErrorCode.INVALID_INPUT });
        const errorResponse = createErrorResponse(
          ErrorCode.INVALID_INPUT,
          urlValidation.error || "Invalid URL",
          timingMs,
          traceId
        );
        res.status(400).json({ ...errorResponse, error: errorResponse.errorMessage });
        return;
      }

      const config = getConfig(req.body.apiKey, req.body.region, req.body.timeoutMs);
      const result = await getContent(config, req.body);
      res.json(wrapResponse(result, timer.elapsed(), traceId));
    } catch (error: any) {
      const timingMs = timer.elapsed();
      executionCounter.inc({ status: 'error', errorCode: ErrorCode.EXECUTION_FAILED });
      const errorResponse = createErrorResponse(
        ErrorCode.EXECUTION_FAILED,
        error.message,
        timingMs,
        traceId
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
        executionCounter.inc({ status: 'error', errorCode: ErrorCode.INVALID_INPUT });
        const errorResponse = createErrorResponse(
          ErrorCode.INVALID_INPUT,
          urlValidation.error || "Invalid URL",
          timingMs,
          traceId
        );
        res.status(400).json({ ...errorResponse, error: errorResponse.errorMessage });
        return;
      }

      const config = getConfig(req.body.apiKey, req.body.region, req.body.timeoutMs);
      const result = await unblockPage(config, req.body);
      res.json(wrapResponse(result, timer.elapsed(), traceId));
    } catch (error: any) {
      const timingMs = timer.elapsed();
      executionCounter.inc({ status: 'error', errorCode: ErrorCode.EXECUTION_FAILED });
      const errorResponse = createErrorResponse(
        ErrorCode.EXECUTION_FAILED,
        error.message,
        timingMs,
        traceId
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
    } catch (error: any) {
      const errorResponse = createErrorResponse(
        ErrorCode.EXECUTION_FAILED,
        error.message,
        timer.elapsed(),
        traceId
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
          traceId
        );
        res.status(400).json({ ...errorResponse, error: errorResponse.errorMessage });
        return;
      }

      if (isCodeTooLong(code)) {
        const errorResponse = createErrorResponse(
          ErrorCode.INVALID_INPUT,
          "Code is too long. Maximum 10000 characters allowed.",
          timer.elapsed(),
          traceId
        );
        res.status(400).json({ ...errorResponse, error: errorResponse.errorMessage });
        return;
      }

      if (hasUnsafeCodePatterns(code)) {
        const errorResponse = createErrorResponse(
          ErrorCode.POLICY_BLOCKED,
          "Code contains potentially unsafe patterns",
          timer.elapsed(),
          traceId
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
    } catch (error: any) {
      const errorResponse = createErrorResponse(
        ErrorCode.EXECUTION_FAILED,
        error.message,
        timer.elapsed(),
        traceId
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
    } catch (error: any) {
      const errorResponse = createErrorResponse(
        ErrorCode.EXECUTION_FAILED,
        error.message,
        timer.elapsed(),
        traceId
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
          traceId
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
    } catch (error: any) {
      const errorResponse = createErrorResponse(
        ErrorCode.EXECUTION_FAILED,
        error.message,
        timer.elapsed(),
        traceId
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
          traceId
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
    } catch (error: any) {
      const errorResponse = createErrorResponse(
        ErrorCode.EXECUTION_FAILED,
        error.message,
        timer.elapsed(),
        traceId
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
    
    if (!BROWSERLESS_API_KEY) {
      console.warn("WARNING: BROWSERLESS_API_KEY not set in environment. API key must be provided with each request.");
    }
  });
}
