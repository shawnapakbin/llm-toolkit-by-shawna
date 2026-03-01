import cors from "cors";
import dotenv from "dotenv";
import express, { type Request, type Response } from "express";
import { browseWeb } from "./browser";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT ?? 3334);
const DEFAULT_TIMEOUT_MS = Number(process.env.BROWSER_DEFAULT_TIMEOUT_MS ?? 20000);
const MAX_TIMEOUT_MS = Number(process.env.BROWSER_MAX_TIMEOUT_MS ?? 60000);
const MAX_CONTENT_CHARS = Number(process.env.BROWSER_MAX_CONTENT_CHARS ?? 12000);

type BrowseRequest = {
  url?: string;
  timeoutMs?: number;
  maxContentChars?: number;
};

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "lm-studio-web-browser-tool" });
});

app.get("/tool-schema", (_req: Request, res: Response) => {
  res.json({
    name: "browse_web",
    description: "Fetches a web page and returns title and extracted text content with SSRF/content-type protections.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The full URL to fetch, including http:// or https://. Private and local network targets are blocked."
        },
        timeoutMs: {
          type: "number",
          description: "Request timeout in milliseconds."
        },
        maxContentChars: {
          type: "number",
          description: "Maximum returned content length in characters."
        }
      },
      required: ["url"]
    }
  });
});

app.post("/tools/browse_web", async (req: Request<unknown, unknown, BrowseRequest>, res: Response) => {
  const url = req.body.url?.trim();

  if (!url || !/^https?:\/\//i.test(url)) {
    res.status(400).json({
      success: false,
      errorCode: "INVALID_INPUT",
      error: "'url' is required and must start with http:// or https://"
    });
    return;
  }

  const timeoutFromReq = Number(req.body.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(timeoutFromReq)
    ? Math.min(Math.max(timeoutFromReq, 1), MAX_TIMEOUT_MS)
    : DEFAULT_TIMEOUT_MS;

  const maxCharsFromReq = Number(req.body.maxContentChars ?? MAX_CONTENT_CHARS);
  const maxContentChars = Number.isFinite(maxCharsFromReq)
    ? Math.min(Math.max(maxCharsFromReq, 200), MAX_CONTENT_CHARS)
    : MAX_CONTENT_CHARS;

  const result = await browseWeb({
    url,
    timeoutMs,
    maxContentChars
  });

  res.status(result.success ? 200 : 400).json(result);
});

app.listen(PORT, () => {
  console.log(`LM Studio Web Browser Tool listening on http://localhost:${PORT}`);
});
