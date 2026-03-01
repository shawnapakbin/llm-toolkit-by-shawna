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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await fetch(input.url, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow"
    });

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
      contentLength: truncated.length
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      finalUrl: input.url,
      title: "",
      content: "",
      contentLength: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    clearTimeout(timeout);
  }
}
