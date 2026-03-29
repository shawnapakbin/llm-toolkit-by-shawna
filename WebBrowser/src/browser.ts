import { MAX_REDIRECTS, isAllowedContentType, validateTargetUrl } from "./policy";

type BrowseInput = {
  url: string;
  timeoutMs: number;
  maxContentChars: number;
};

type BrowseResult = {
  success: boolean;
  status: number;
  finalUrl: string;
  title: string;
  content: string;
  contentLength: number;
  error?: string;
  errorCode?: string;
};

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return (match?.[1] ?? "").replace(/\s+/g, " ").trim();
}

function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export async function browseWeb(input: BrowseInput): Promise<BrowseResult> {
  const targetValidation = validateTargetUrl(input.url);
  if (!targetValidation.ok) {
    return {
      success: false,
      status: 0,
      finalUrl: input.url,
      title: "",
      content: "",
      contentLength: 0,
      error: targetValidation.message,
      errorCode: targetValidation.errorCode,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    let currentUrl = input.url;
    let response: Response | null = null;

    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
      const currentValidation = validateTargetUrl(currentUrl);
      if (!currentValidation.ok) {
        return {
          success: false,
          status: 0,
          finalUrl: currentUrl,
          title: "",
          content: "",
          contentLength: 0,
          error: currentValidation.message,
          errorCode: currentValidation.errorCode,
        };
      }

      response = await fetch(currentUrl, {
        method: "GET",
        signal: controller.signal,
        redirect: "manual",
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          break;
        }
        currentUrl = new URL(location, currentUrl).toString();

        if (redirectCount === MAX_REDIRECTS) {
          return {
            success: false,
            status: response.status,
            finalUrl: currentUrl,
            title: "",
            content: "",
            contentLength: 0,
            error: `Redirect limit exceeded (${MAX_REDIRECTS}).`,
            errorCode: "EXECUTION_FAILED",
          };
        }

        continue;
      }

      break;
    }

    if (!response) {
      return {
        success: false,
        status: 0,
        finalUrl: input.url,
        title: "",
        content: "",
        contentLength: 0,
        error: "No response received.",
        errorCode: "EXECUTION_FAILED",
      };
    }

    const contentType = response.headers.get("content-type");
    if (!isAllowedContentType(contentType)) {
      return {
        success: false,
        status: response.status,
        finalUrl: response.url,
        title: "",
        content: "",
        contentLength: 0,
        error: `Unsupported content type: ${contentType}`,
        errorCode: "POLICY_BLOCKED",
      };
    }

    const html = await response.text();
    const title = extractTitle(html);
    const text = htmlToText(html);
    const truncated = text.slice(0, input.maxContentChars);

    return {
      success: response.ok,
      status: response.status,
      finalUrl: response.url,
      title,
      content: truncated,
      contentLength: truncated.length,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      finalUrl: input.url,
      title: "",
      content: "",
      contentLength: 0,
      error: error instanceof Error ? error.message : String(error),
      errorCode: "EXECUTION_FAILED",
    };
  } finally {
    clearTimeout(timeout);
  }
}
