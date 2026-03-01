import cors from "cors";
import dotenv from "dotenv";
import express, { type Request, type Response } from "express";
import { evaluateExpression } from "./calculator";
import {
  validatePrecision,
  isValidExpression,
  isExpressionTooLong,
  hasUnsafePatterns,
  DEFAULT_PRECISION,
} from "./policy";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT ?? 3335);

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

  if (!isValidExpression(expression)) {
    res.status(400).json({ error: "'expression' is required." });
    return;
  }

  if (isExpressionTooLong(expression!)) {
    res.status(400).json({ error: "Expression is too long. Maximum 1000 characters allowed." });
    return;
  }

  if (hasUnsafePatterns(expression!)) {
    res.status(403).json({ error: "Expression contains potentially unsafe patterns." });
    return;
  }

  const configuredDefault = Number(process.env.CALCULATOR_DEFAULT_PRECISION ?? DEFAULT_PRECISION);
  const precision = validatePrecision(req.body.precision, configuredDefault);

  const result = evaluateExpression({ expression: expression!, precision });
  res.status(result.success ? 200 : 400).json(result);
});

// Export app for testing
export { app };

// Only start server if this is the main module
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`LM Studio Calculator Tool listening on http://localhost:${PORT}`);
  });
}
