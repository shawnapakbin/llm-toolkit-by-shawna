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

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3003;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Get API key from environment or request
const BROWSERLESS_API_KEY = process.env.BROWSERLESS_API_KEY || "";
const DEFAULT_REGION = process.env.BROWSERLESS_DEFAULT_REGION || "production-sfo";
const DEFAULT_TIMEOUT_MS = Number(process.env.BROWSERLESS_DEFAULT_TIMEOUT_MS ?? 30000);
const CONCURRENCY_LIMIT = Number(process.env.BROWSERLESS_CONCURRENCY_LIMIT ?? 5);

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
  
  if (!effectiveApiKey) {
    throw new Error("Browserless API key is required. Provide via BROWSERLESS_API_KEY environment variable or apiKey in request body.");
  }

  return {
    apiKey: effectiveApiKey,
    region: region as any || DEFAULT_REGION,
    timeoutMs: timeoutMs || DEFAULT_TIMEOUT_MS,
  };
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "browserless-tool" });
});

// Screenshot endpoint
app.post("/screenshot", async (req, res) => {
  return executeWithConcurrencyLimit(async () => {
    try {
      const config = getConfig(req.body.apiKey, req.body.region, req.body.timeoutMs);
      const result = await takeScreenshot(config, req.body);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

// PDF endpoint
app.post("/pdf", async (req, res) => {
  return executeWithConcurrencyLimit(async () => {
    try {
      const config = getConfig(req.body.apiKey, req.body.region, req.body.timeoutMs);
      const result = await generatePDF(config, req.body);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

// Scrape endpoint
app.post("/scrape", async (req, res) => {
  return executeWithConcurrencyLimit(async () => {
    try {
      const config = getConfig(req.body.apiKey, req.body.region, req.body.timeoutMs);
      const result = await scrapePage(config, req.body);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

// Content endpoint
app.post("/content", async (req, res) => {
  return executeWithConcurrencyLimit(async () => {
    try {
      const config = getConfig(req.body.apiKey, req.body.region, req.body.timeoutMs);
      const result = await getContent(config, req.body);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

// Unblock endpoint
app.post("/unblock", async (req, res) => {
  return executeWithConcurrencyLimit(async () => {
    try {
      const config = getConfig(req.body.apiKey, req.body.region, req.body.timeoutMs);
      const result = await unblockPage(config, req.body);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

// BQL endpoint
app.post("/bql", async (req, res) => {
  return executeWithConcurrencyLimit(async () => {
    try {
      const config = getConfig(req.body.apiKey, req.body.region, req.body.timeoutMs);
      const result = await executeBQL(config, {
        query: req.body.query,
        variables: req.body.variables,
        operationName: req.body.operationName,
        replay: req.body.replay !== false, // Default to true for session recording
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

// Function endpoint - execute custom Puppeteer code
app.post("/function", async (req, res) => {
  return executeWithConcurrencyLimit(async () => {
    try {
      const config = getConfig(req.body.apiKey, req.body.region, req.body.timeoutMs);
      const result = await executeFunction(config, {
        code: req.body.code,
        context: req.body.context,
        timeout: req.body.timeoutMs,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

// Download endpoint - retrieve files that Chrome downloads
app.post("/download", async (req, res) => {
  return executeWithConcurrencyLimit(async () => {
    try {
      const config = getConfig(req.body.apiKey, req.body.region, req.body.timeoutMs);
      const result = await downloadFile(config, {
        code: req.body.code,
        context: req.body.context,
        timeout: req.body.timeoutMs,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

// Export endpoint - fetch URL and stream content
app.post("/export", async (req, res) => {
  return executeWithConcurrencyLimit(async () => {
    try {
      const config = getConfig(req.body.apiKey, req.body.region, req.body.timeoutMs);
      const result = await exportPage(config, {
        url: req.body.url,
        includeResources: req.body.includeResources ?? false,
        timeout: req.body.timeoutMs,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

// Performance endpoint - Lighthouse audits
app.post("/performance", async (req, res) => {
  return executeWithConcurrencyLimit(async () => {
    try {
      const config = getConfig(req.body.apiKey, req.body.region, req.body.timeoutMs);
      const result = await performanceLighthouse(config, {
        url: req.body.url,
        config: req.body.config,
        timeout: req.body.timeoutMs,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Browserless tool server running on http://localhost:${PORT}`);
  
  if (!BROWSERLESS_API_KEY) {
    console.warn("WARNING: BROWSERLESS_API_KEY not set in environment. API key must be provided with each request.");
  }
});
