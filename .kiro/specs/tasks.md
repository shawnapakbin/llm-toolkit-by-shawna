# Implementation Plan: v2.1.0 — Headless Browser + Skills + ECM + Version Bump

## Overview

Three new features land in v2.1.0, each following the established monorepo pattern.
Tasks are ordered so each feature is fully wired before the next begins.
All TypeScript; property-based tests use `fast-check` and are marked optional (`*`).

---

## Feature 1: Headless Web Browser (Playwright Upgrade)

Upgrade `WebBrowser/src/browser.ts` from `fetch`+regex to Playwright headless Chromium.
MCP tool name (`browse_web`), HTTP port (3334), and response envelope are unchanged.

- [x] 1. Add Playwright dependency and update WebBrowser package
- [x] 2. Implement `BrowserPool` singleton in `WebBrowser/src/browser.ts`
  - [x] 2.1 Write `BrowserPool` with lazy `chromium.launch()`, mutex for concurrent launch, and `shutdown()` method
  - [x] 2.2 Write property test: SSRF policy blocks all private/loopback ranges (covers browser singleton safety)
- [x] 3. Implement `extractContent` in-page function in `WebBrowser/src/browser.ts`
  - [x] 3.1 Write self-contained `extractContent(outputFormat)` that runs via `page.evaluate()`
  - [x] 3.2 Write property test: content-type allowlist correctness
  - [x] 3.3 Write property test: content truncation invariant (`content.length <= maxContentChars`)
  - [x] 3.4 Write property test: non-http/https protocols always return `INVALID_INPUT`
- [x] 4. Rewrite `browseWeb` orchestration in `WebBrowser/src/browser.ts`
  - [x] 4.1 Replace fetch-based implementation with Playwright page lifecycle
  - [x]* 4.2–4.6 Property tests: SSRF, truncation, content-type, shape invariants (covered in property.test.ts)
- [x] 5. Update `WebBrowser/src/policy.ts` — add `application/json` to allowed content types
- [x] 6. Update `WebBrowser/src/mcp-server.ts` with new optional Zod fields
- [x] 7. Update `WebBrowser/src/index.ts` HTTP handler
- [x] 8. Update `WebBrowser/src/browser.ts` types and env config
- [x] 9. Checkpoint — 10/10 existing tests pass + 9/9 property tests pass

---

## Feature 2: Skills Tool (New `Skills/` Workspace)

New monorepo workspace following the `RAG/` / `AskUser/` pattern.
MCP tool: `skills`. HTTP port: 3341. SQLite via `better-sqlite3`.

- [x] 10. Scaffold `Skills/` workspace
- [x] 11. Define shared types in `Skills/src/types.ts`
- [x] 12. Implement `Skills/src/store.ts` — SQLite persistence
  - [x] 12.1 Write `SkillsStore` class with schema init, upsert with version increment, CRUD
  - [x] 12.2 Write property test: upsert N times with same name yields `version = N`
  - [x] 12.3 Write property test: interpolation correctness and step resolution length invariant
- [x] 13. Implement `Skills/src/policy.ts` — input validation
  - [x] 13.1 Write all five validate functions
  - [x]* 13.2 Write property test: kebab-case validation
  - [x]* 13.3 Write property test: description length boundary
- [x] 14. Implement `Skills/src/skills.ts` — core logic
  - [x] 14.1 Write `defineSkill`, `getSkill`, `listSkills`, `deleteSkill`
  - [x] 14.2 Write `interpolate` and `resolveSteps`
  - [x] 14.3 Write `executeSkill`
  - [x]* 14.4–14.8 Property tests: step resolution, interpolation, round-trips (covered in property.test.ts)
- [x] 15. Implement `Skills/src/mcp-server.ts`
- [x] 16. Implement `Skills/src/index.ts` — Express HTTP server on port 3341
- [x] 17. Write `Skills/tests/http.test.ts` and `Skills/tests/mcp.test.ts`
- [x] 18. Checkpoint — 17/17 HTTP+MCP tests pass + 11/11 property tests pass

---

## Feature 3: ECM Tool (New `ECM/` Workspace)

New monorepo workspace following the `RAG/` pattern.
MCP tool: `ecm`. HTTP port: 3342. SQLite + vector embeddings via LM Studio.

- [x] 19. Scaffold `ECM/` workspace
- [x] 20. Define shared types in `ECM/src/types.ts`
- [x] 21. Implement `ECM/src/embeddings.ts` — embedding provider (mock + LM Studio)
- [x] 22. Implement `ECM/src/store.ts` — SQLite persistence
  - [x] 22.1 Write `ECMStore` class with schema init, all CRUD methods
  - [x]* 22.2 Session isolation property tests (covered in property.test.ts)
- [x] 23. Implement `ECM/src/policy.ts` — input validation (all 6 validate functions)
- [x] 24. Implement core scoring and summarization in `ECM/src/ecm.ts`
  - [x] 24.1 Write `computeScore` with composite formula
  - [x]* 24.2 Write property test: score is finite, recency monotonically decreasing
  - [x] 24.3 Write `extractiveSummarize` — purely extractive, no LLM
  - [x]* 24.4 Write property test: output bounded by `min(N*200, 2000)`
- [x] 25. Implement ECM operations in `ECM/src/ecm.ts`
  - [x] 25.1 Write `storeSegment` — atomic, no partial write on embed failure
  - [x]* 25.2 Write property test: token count consistency
  - [x]* 25.3 Write property test: no partial write on embed failure
  - [x] 25.4 Write `retrieveContext` with budget enforcement
  - [x]* 25.5 Write property test: `totalTokens <= maxTokens` always holds
  - [x]* 25.6 Write property test: recency score monotonicity
  - [x] 25.7 Write `listSegments`, `deleteSegment`, `clearSession`
  - [x]* 25.8 Write property test: session isolation (store + clearSession)
  - [x] 25.9 Write `summarizeSession` — extractive, transactional
  - [x]* 25.10 Property test: summarize is destructive-then-constructive (covered via HTTP test)
- [x] 26. Implement `ECM/src/mcp-server.ts`
- [x] 27. Implement `ECM/src/index.ts` — Express HTTP server on port 3342
- [x] 28. Write `ECM/tests/http.test.ts`, `mcp.test.ts`, and `property.test.ts`
- [x] 29. Checkpoint — 18/18 HTTP+MCP tests pass + 12/12 property tests pass

---

## Feature 4: Version Bump and Integration (v2.1.0)

- [x] 30. Update root `package.json` for v2.1.0 — version bump, Skills+ECM in workspaces + build scripts
- [x] 31. Update `scripts/workspace/mcp-config.js` — skills, ecm, BROWSER_HEADLESS entries
- [x] 32. Update `docs/ARCHITECTURE.md` — 9 tools listed, version 2.1.0
- [x] 33. Update root `README.md` — 11 tools, new mcp.json example, features table
- [x] 34. Final checkpoint — full build + test suite + type-check ✅ 75/75 tests passing across 9 suites

---

## Notes

- Tasks marked with `*` are optional property-based tests using `fast-check`
- All property tests are implemented in `*/tests/property.test.ts` files
- All SQLite tests use `:memory:` path; ECM tests use `ECM_EMBEDDINGS_MODE=mock`
- Checkpoints (9, 18, 29, 34) validate incrementally before moving to the next feature
- Total tests: 75 passing across 9 test suites (WebBrowser: 19, Skills: 28, ECM: 28)
