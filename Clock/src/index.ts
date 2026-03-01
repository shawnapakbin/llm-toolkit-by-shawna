import cors from "cors";
import dotenv from "dotenv";
import express, { type Request, type Response } from "express";
import { getClockSnapshot } from "./clock";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT ?? 3337);

type ClockRequestBody = {
  timeZone?: string;
  locale?: string;
};

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "lm-studio-clock-tool" });
});

app.get("/tool-schema", (_req: Request, res: Response) => {
  res.json({
    name: "get_current_datetime",
    description: "Returns the current date, time, and timezone details. Optionally converts to a requested IANA timezone.",
    parameters: {
      type: "object",
      properties: {
        timeZone: {
          type: "string",
          description: "Optional IANA timezone, e.g. 'UTC', 'America/New_York', 'Asia/Kolkata'. Defaults to system timezone."
        },
        locale: {
          type: "string",
          description: "Optional locale used for weekday/timezone naming, e.g. 'en-US'."
        }
      },
      required: []
    }
  });
});

app.post("/tools/get_current_datetime", (req: Request<unknown, unknown, ClockRequestBody>, res: Response) => {
  const result = getClockSnapshot({
    timeZone: req.body.timeZone,
    locale: req.body.locale
  });

  res.status(result.success ? 200 : 400).json(result);
});

app.listen(PORT, () => {
  console.log(`LM Studio Clock Tool listening on http://localhost:${PORT}`);
});
