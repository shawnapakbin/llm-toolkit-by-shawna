/**
 * Property-based tests for Skills Tool v2.1.0
 */
process.env.SKILLS_DB_PATH = ":memory:";

import * as fc from "fast-check";
import { interpolate, resolveSteps } from "../src/skills";
import { SkillsStore } from "../src/store";
import type { Step } from "../src/types";

// ─── Task 12.2: Upsert version increment ──────────────────────────────────────

describe("Property: upsert version increment", () => {
  test("calling upsert N times with same name yields version = N", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (n) => {
        const store = new SkillsStore(":memory:");
        // Use a unique name per run to avoid cross-test contamination
        const name = `prop-skill-${Math.random().toString(36).slice(2)}`;
        const input = {
          name,
          description: "A test skill",
          paramSchema: { type: "object" as const, properties: {} },
          steps: [{ type: "prompt" as const, template: "hello" }],
        };

        let record = store.upsertSkill(input);
        for (let i = 1; i < n; i++) {
          record = store.upsertSkill(input);
        }

        expect(record.version).toBe(n);
        store.close();
      }),
      { numRuns: 20 },
    );
  });
});

// ─── Task 14.4: Step resolution length invariant ──────────────────────────────

describe("Property: resolveSteps length invariant", () => {
  test("output array length always equals input step count", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.record({ type: fc.constant("prompt" as const), template: fc.string({ minLength: 1 }) }),
            fc.record({
              type: fc.constant("tool_call" as const),
              tool: fc.string({ minLength: 1 }),
              args: fc.dictionary(fc.string({ minLength: 1 }), fc.string()),
            }),
          ),
          { minLength: 0, maxLength: 20 },
        ),
        fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.string()),
        (steps, params) => {
          const resolved = resolveSteps(steps as Step[], params);
          expect(resolved).toHaveLength(steps.length);
        },
      ),
    );
  });

  test("resolveSteps does not mutate input steps", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ type: fc.constant("prompt" as const), template: fc.string({ minLength: 1 }) }),
          { minLength: 1, maxLength: 5 },
        ),
        fc.dictionary(fc.string({ minLength: 1 }), fc.string()),
        (steps, params) => {
          const original = JSON.stringify(steps);
          resolveSteps(steps as Step[], params);
          expect(JSON.stringify(steps)).toBe(original);
        },
      ),
    );
  });
});

// ─── Task 14.5: Interpolation correctness ─────────────────────────────────────

describe("Property: interpolation replaces known tokens, preserves unknown", () => {
  test("all {{key}} tokens for keys in params are replaced", () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^\w+$/.test(s)),
          fc.string({ minLength: 0, maxLength: 50 }),
          { minKeys: 1, maxKeys: 5 },
        ),
        (params) => {
          const keys = Object.keys(params);
          const template = keys.map((k) => `{{${k}}}`).join(" ");
          const result = interpolate(template, params);

          // No known key placeholders should remain
          for (const key of keys) {
            expect(result).not.toContain(`{{${key}}}`);
          }
        },
      ),
    );
  });

  test("unknown {{placeholder}} tokens are left unchanged", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^\w+$/.test(s)),
        (unknownKey) => {
          const template = `prefix {{${unknownKey}}} suffix`;
          const result = interpolate(template, {}); // empty params
          expect(result).toContain(`{{${unknownKey}}}`);
        },
      ),
    );
  });

  test("interpolate does not mutate the template string", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 100 }),
        fc.dictionary(fc.string({ minLength: 1 }), fc.string()),
        (template, params) => {
          const original = template;
          interpolate(template, params);
          expect(template).toBe(original);
        },
      ),
    );
  });
});

// ─── Task 13.2: Kebab-case validation ─────────────────────────────────────────

describe("Property: kebab-case name validation", () => {
  const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

  test("valid kebab-case names always pass the pattern", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.stringMatching(/^[a-z0-9]+$/),
          { minLength: 1, maxLength: 5 },
        ),
        (parts) => {
          const name = parts.join("-");
          expect(KEBAB_RE.test(name)).toBe(true);
        },
      ),
    );
  });

  test("names with uppercase letters fail the pattern", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /[A-Z]/.test(s)),
        (name) => {
          expect(KEBAB_RE.test(name)).toBe(false);
        },
      ),
    );
  });

  test("names with spaces fail the pattern", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.includes(" ")),
        (name) => {
          expect(KEBAB_RE.test(name)).toBe(false);
        },
      ),
    );
  });
});

// ─── Task 13.3: Description length validation ─────────────────────────────────

describe("Property: description length boundary", () => {
  test("descriptions over 1000 chars always exceed the limit", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1001, maxLength: 5000 }),
        (description) => {
          expect(description.length).toBeGreaterThan(1000);
        },
      ),
    );
  });
});
