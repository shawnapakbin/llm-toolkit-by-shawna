export interface BrowserlessConfig {
  apiKey: string;
  region?: "production-sfo" | "production-lon" | "production-ams";
  timeoutMs?: number;
}

export interface ScreenshotOptions {
  url: string;
  fullPage?: boolean;
  type?: "png" | "jpeg" | "webp";
  quality?: number;
  selector?: string;
  waitForTimeout?: number;
  waitForSelector?: string;
}

export interface ScreenshotResult {
  success: boolean;
  base64?: string;
  error?: string;
  metadata?: {
    url: string;
    timestamp: string;
    format: string;
  };
}

export interface PDFOptions {
  url: string;
  format?:
    | "Letter"
    | "Legal"
    | "Tabloid"
    | "Ledger"
    | "A0"
    | "A1"
    | "A2"
    | "A3"
    | "A4"
    | "A5"
    | "A6";
  landscape?: boolean;
  printBackground?: boolean;
  scale?: number;
  waitForTimeout?: number;
  waitForSelector?: string;
}

export interface PDFResult {
  success: boolean;
  base64?: string;
  error?: string;
  metadata?: {
    url: string;
    timestamp: string;
    pageCount?: number;
  };
}

export interface ScrapeOptions {
  url: string;
  elements: Array<{
    selector: string;
    timeout?: number;
  }>;
  waitForTimeout?: number;
  waitForSelector?: string;
}

export interface ScrapeResult {
  success: boolean;
  data?: Array<{
    selector: string;
    results: Array<{
      text?: string;
      html?: string;
      attributes?: Array<{ name: string; value: string }>;
      width?: number;
      height?: number;
      top?: number;
      left?: number;
    }>;
  }>;
  error?: string;
  metadata?: {
    url: string;
    timestamp: string;
  };
}

export interface ContentOptions {
  url: string;
  waitForTimeout?: number;
  waitForSelector?: string;
}

export interface ContentResult {
  success: boolean;
  html?: string;
  text?: string;
  error?: string;
  metadata?: {
    url: string;
    timestamp: string;
    contentLength?: number;
  };
}

export interface UnblockOptions {
  url: string;
  cookies?: boolean;
  content?: boolean;
  screenshot?: boolean;
  browserWSEndpoint?: boolean;
}

export interface UnblockResult {
  success: boolean;
  data?: {
    html?: string;
    cookies?: Array<Record<string, unknown>>;
    screenshot?: string;
    browserWSEndpoint?: string;
  };
  error?: string;
  metadata?: {
    url: string;
    timestamp: string;
  };
}

export interface BQLOptions {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
  replay?: boolean;
}

export interface BQLResult {
  success: boolean;
  data?: unknown;
  errors?: Array<{ message: string }>;
  error?: string;
  metadata?: {
    timestamp: string;
    operationName?: string;
  };
}

export interface FunctionOptions {
  code: string;
  context?: Record<string, unknown>;
  timeout?: number;
}

export interface FunctionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: {
    timestamp: string;
    executionTimeMs?: number;
  };
}

export interface DownloadOptions {
  code: string;
  context?: Record<string, unknown>;
  timeout?: number;
}

export interface DownloadResult {
  success: boolean;
  base64?: string;
  filename?: string;
  contentType?: string;
  error?: string;
  metadata?: {
    timestamp: string;
    fileSizeBytes?: number;
  };
}

export interface ExportOptions {
  url: string;
  includeResources?: boolean;
  timeout?: number;
}

export interface ExportResult {
  success: boolean;
  base64?: string;
  contentType?: string;
  error?: string;
  metadata?: {
    url: string;
    timestamp: string;
    contentSizeBytes?: number;
  };
}

export interface PerformanceOptions {
  url: string;
  config?: Record<string, unknown>;
  timeout?: number;
}

export interface PerformanceResult {
  success: boolean;
  data?: {
    scores?: {
      performance?: number;
      accessibility?: number;
      bestPractices?: number;
      seo?: number;
    };
    metrics?: Record<string, unknown>;
  };
  error?: string;
  metadata?: {
    url: string;
    timestamp: string;
  };
}

const DEFAULT_REGION = "production-sfo";
const DEFAULT_TIMEOUT_MS = 30000;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getBaseUrl(region: string = DEFAULT_REGION): string {
  return `https://${region}.browserless.io`;
}

export async function takeScreenshot(
  config: BrowserlessConfig,
  options: ScreenshotOptions,
): Promise<ScreenshotResult> {
  const region = config.region || DEFAULT_REGION;
  const timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS;
  const baseUrl = getBaseUrl(region);
  const url = `${baseUrl}/screenshot?token=${config.apiKey}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify({
        url: options.url,
        fullPage: options.fullPage ?? false,
        type: options.type ?? "png",
        quality: options.quality,
        selector: options.selector,
        waitForTimeout: options.waitForTimeout,
        waitForSelector: options.waitForSelector,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    return {
      success: true,
      base64,
      metadata: {
        url: options.url,
        timestamp: new Date().toISOString(),
        format: options.type ?? "png",
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}

export async function generatePDF(
  config: BrowserlessConfig,
  options: PDFOptions,
): Promise<PDFResult> {
  const region = config.region || DEFAULT_REGION;
  const timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS;
  const baseUrl = getBaseUrl(region);
  const url = `${baseUrl}/pdf?token=${config.apiKey}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify({
        url: options.url,
        format: options.format ?? "A4",
        landscape: options.landscape ?? false,
        printBackground: options.printBackground ?? true,
        scale: options.scale ?? 1,
        waitForTimeout: options.waitForTimeout,
        waitForSelector: options.waitForSelector,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    return {
      success: true,
      base64,
      metadata: {
        url: options.url,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}

export async function scrapePage(
  config: BrowserlessConfig,
  options: ScrapeOptions,
): Promise<ScrapeResult> {
  const region = config.region || DEFAULT_REGION;
  const timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS;
  const baseUrl = getBaseUrl(region);
  const url = `${baseUrl}/scrape?token=${config.apiKey}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify({
        url: options.url,
        elements: options.elements,
        waitForTimeout: options.waitForTimeout,
        waitForSelector: options.waitForSelector,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const result = (await response.json()) as { data?: ScrapeResult["data"] };

    return {
      success: true,
      data: result.data,
      metadata: {
        url: options.url,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}

export async function getContent(
  config: BrowserlessConfig,
  options: ContentOptions,
): Promise<ContentResult> {
  const region = config.region || DEFAULT_REGION;
  const timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS;
  const baseUrl = getBaseUrl(region);
  const url = `${baseUrl}/content?token=${config.apiKey}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify({
        url: options.url,
        waitForTimeout: options.waitForTimeout,
        waitForSelector: options.waitForSelector,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const result = (await response.json()) as { data?: { html?: string; text?: string } };

    return {
      success: true,
      html: result.data?.html,
      text: result.data?.text,
      metadata: {
        url: options.url,
        timestamp: new Date().toISOString(),
        contentLength: result.data?.html?.length || 0,
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}

export async function unblockPage(
  config: BrowserlessConfig,
  options: UnblockOptions,
): Promise<UnblockResult> {
  const region = config.region || DEFAULT_REGION;
  const timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS;
  const baseUrl = getBaseUrl(region);
  const url = `${baseUrl}/unblock?token=${config.apiKey}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify({
        url: options.url,
        cookies: options.cookies ?? false,
        content: options.content ?? false,
        screenshot: options.screenshot ?? false,
        browserWSEndpoint: options.browserWSEndpoint ?? false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const result = (await response.json()) as { data?: UnblockResult["data"] };

    return {
      success: true,
      data: result.data,
      metadata: {
        url: options.url,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}

export async function executeBQL(
  config: BrowserlessConfig,
  options: BQLOptions,
): Promise<BQLResult> {
  const region = config.region || DEFAULT_REGION;
  const timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS;
  const baseUrl = getBaseUrl(region);
  let url = `${baseUrl}/chrome/bql?token=${config.apiKey}`;
  if (options.replay ?? true) {
    url += "&replay=true";
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify({
        query: options.query,
        variables: options.variables,
        operationName: options.operationName,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const result = (await response.json()) as {
      data?: unknown;
      errors?: Array<{ message: string }>;
    };

    if (result.errors && result.errors.length > 0) {
      return {
        success: false,
        errors: result.errors,
        error: result.errors.map((e) => e.message).join(", "),
      };
    }

    return {
      success: true,
      data: result.data,
      metadata: {
        timestamp: new Date().toISOString(),
        operationName: options.operationName,
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}

export async function executeFunction(
  config: BrowserlessConfig,
  options: FunctionOptions,
): Promise<FunctionResult> {
  const region = config.region || DEFAULT_REGION;
  const timeoutMs = options.timeout || config.timeoutMs || DEFAULT_TIMEOUT_MS;
  const baseUrl = getBaseUrl(region);
  const url = `${baseUrl}/function?token=${config.apiKey}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const startTime = Date.now();

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify({
        code: options.code,
        context: options.context,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const executionTimeMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const result = (await response.json()) as { data?: PerformanceResult["data"] };

    return {
      success: true,
      data: result.data,
      metadata: {
        timestamp: new Date().toISOString(),
        executionTimeMs,
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}

export async function downloadFile(
  config: BrowserlessConfig,
  options: DownloadOptions,
): Promise<DownloadResult> {
  const region = config.region || DEFAULT_REGION;
  const timeoutMs = options.timeout || config.timeoutMs || DEFAULT_TIMEOUT_MS;
  const baseUrl = getBaseUrl(region);
  const url = `${baseUrl}/download?token=${config.apiKey}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify({
        code: options.code,
        context: options.context,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const contentDisposition = response.headers.get("content-disposition");
    let filename = "download";

    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^";\n]*)"?/i);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    return {
      success: true,
      base64,
      filename,
      contentType,
      metadata: {
        timestamp: new Date().toISOString(),
        fileSizeBytes: buffer.byteLength,
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}

export async function exportPage(
  config: BrowserlessConfig,
  options: ExportOptions,
): Promise<ExportResult> {
  const region = config.region || DEFAULT_REGION;
  const timeoutMs = options.timeout || config.timeoutMs || DEFAULT_TIMEOUT_MS;
  const baseUrl = getBaseUrl(region);
  let url = `${baseUrl}/export?token=${config.apiKey}&url=${encodeURIComponent(options.url)}`;

  if (options.includeResources) {
    url += "&includeResources=true";
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    return {
      success: true,
      base64,
      contentType,
      metadata: {
        url: options.url,
        timestamp: new Date().toISOString(),
        contentSizeBytes: buffer.byteLength,
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}

export async function performanceLighthouse(
  config: BrowserlessConfig,
  options: PerformanceOptions,
): Promise<PerformanceResult> {
  const region = config.region || DEFAULT_REGION;
  const timeoutMs = options.timeout || config.timeoutMs || DEFAULT_TIMEOUT_MS;
  const baseUrl = getBaseUrl(region);
  const url = `${baseUrl}/performance?token=${config.apiKey}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify({
        url: options.url,
        config: options.config,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const result = (await response.json()) as { data?: PerformanceResult["data"] };

    return {
      success: true,
      data: result.data,
      metadata: {
        url: options.url,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}
