import cors from "cors";
import dotenv from "dotenv";
import express, { type Request, type Response } from "express";
import { evaluateExpression } from "./calculator";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT ?? 3335);
const DEFAULT_PRECISION = Number(process.env.CALCULATOR_DEFAULT_PRECISION ?? 12);
const MAX_PRECISION = Number(process.env.CALCULATOR_MAX_PRECISION ?? 20);

type CalculateRequest = {
  expression?: string;
  precision?: number;
};

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "lm-studio-calculator-tool" });
});

app.get("/tool-schema", (_req: Request, res: Response) => {
  res.json({
    name: "calculate_engineering",
    description: "Evaluates engineering/math expressions including trig, logs, powers, units, and common symbols like °, π, ×, ÷, √, Ω.",
    parameters: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "Math expression to evaluate, e.g. 'sin(30°)', 'sin(π/6)^2 + cos(π/6)^2', '20×log10(5)', '√2^10', '10 Ω * 2 A'."
        },
        precision: {
          type: "number",
          description: "Significant digits for formatted output."
        }
      },
      required: ["expression"]
    }
  });
});

app.post("/tools/calculate_engineering", (req: Request<unknown, unknown, CalculateRequest>, res: Response) => {
  const expression = req.body.expression?.trim();

  if (!expression) {
    res.status(400).json({ error: "'expression' is required." });
    return;
  }

  const precisionFromReq = Number(req.body.precision ?? DEFAULT_PRECISION);
  const precision = Number.isFinite(precisionFromReq)
    ? Math.min(Math.max(Math.trunc(precisionFromReq), 2), MAX_PRECISION)
    : DEFAULT_PRECISION;

  const result = evaluateExpression({ expression, precision });
  res.status(result.success ? 200 : 400).json(result);
});

app.listen(PORT, () => {
  console.log(`LM Studio Calculator Tool listening on http://localhost:${PORT}`);
});
