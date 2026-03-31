# Implementation Plan: v2.1.0 — Headless Browser + Skills + ECM + Version Bump

## Overview

Three new features land in v2.1.0, each following the established monorepo pattern.
Tasks are ordered so each feature is fully wired before the next begins.
All TypeScript; property-based tests use `fast-check` and are marked optional (`*`).

---

## Feature 1: Headless Web Browser (Playwright Upgrade)

Upgrade `WebBrowser/src/browser.ts` from `fetch`+regex to Playwright headless Chromium.
MCP tool name (`browse_web`), HTTP port (3334), and response envelope are unchanged.

- [ ] 1. Add Playwright dependency and update WebBrowser package
  - Add `playwright: ^1.40.0` to `WebBrowser/package.json` dependencies
  - Remove any `node-fetch` references if present
  - Add `postinstall` note in README: `npx playwright install chromium`
  - _Requirements: 1.1, 2.1_

- [ ] 2. Implement `BrowserPool` singleton in `WebBrowser/src/browser.ts`
  - [ ] 2.1 Write `BrowserPool` with lazy `chromium.launch()`, mutex for concurrent launch, and `shutdown()` method
    - Respect `BROWSER_HEADLESS` and `BROWSER_EXECUTABLE_PATH` env vars
    - Register `process.on('exit'|'SIGTERM'|'SIGINT')` shutdown hooks once
    - Handle unexpected browser disconnect: null the instance so next request re-launches
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [ ]* 2.2 Write property test: `BrowserPool.getPage()` calls `chromium.launch()` at most once across N concurrent calls
    - **Property 5: Browser singleton across concurrent requests**
    - **Validates: Requirements 2.1, 2.2**

- [ ] 3. Implement `extractContent` in-page function in `WebBrowser/src/browser.ts`
  - [ ] 3.1 Write self-contained `extractContent(outputFormat)` that runs via `page.evaluate()`
    - Remove `<script>`, `<style>`, `<noscript>`, `<svg>` subtrees before traversal
    - `'text'` mode: whitespace-normalized plain text
    - `'markdown'` mode: h1–h6 → `#`–`######`, `<a>` → `[text](href)`, `<li>` → `- item`, `<strong>`/`<b>` → `**text**`, `<em>`/`<i>` → `_text_`
    - Use `document.title` for title field; rely on browser DOM for entity decoding
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_
  - [ ]* 3.2 Write property test: markdown headings always match `/^#{1,6} .+/` for any h1–h6 element
    - **Property 7: Markdown heading hierarchy**
    - **Validates: Requirements 5.4**
  - [ ]* 3.3 Write property test: noise element text never appears in extracted content
    - **Property 9: Noise element exclusion**
    - **Validates: Requirements 5.1**
  - [ ]* 3.4 Write property test: HTML entity strings (`&amp;`, `&lt;`, etc.) never appear in output
    - **Property 6: HTML entity decoding**
    - **Validates: Requirements 5.9**

- [ ] 4. Rewrite `browseWeb` orchestration in `WebBrowser/src/browser.ts`
  - [ ] 4.1 Replace fetch-based implementation with Playwright page lifecycle
    - Call `validateTargetUrl` before any Playwright call
    - Inject cookies via `page.context().addCookies()` before `page.goto()`
    - Choose `waitUntil: 'networkidle'` or `'domcontentloaded'` based on `waitForNetworkIdle`
    - Inspect `response.headers()['content-type']` from Playwright `Response` object
    - Call `page.waitForSelector()` when `waitForSelector` is provided
    - Call `page.evaluate(extractContent, outputFormat)` for DOM extraction
    - Truncate content to `maxContentChars`; set `contentLength = content.length`
    - Capture screenshot when `screenshot: true`; omit `screenshotBase64` otherwise
    - Always close page in `finally`; never throw to caller
    - Set `finalUrl` to `page.url()` post-navigation
    - _Requirements: 1.1–1.6, 3.1, 3.2, 4.1, 4.2, 6.1, 6.2, 7.1–7.3, 8.1–8.3, 9.1–9.3, 10.1–10.5, 11.1, 11.2_
  - [ ]* 4.2 Write property test: `browseWeb` never throws for any input
    - **Property 11: browseWeb never throws**
    - **Validates: Requirements 10.1**
  - [ ]* 4.3 Write property test: `result.content.length <= input.maxContentChars` and `result.contentLength === result.content.length`
    - **Property 3: Content truncation invariant**
    - **Validates: Requirements 6.1, 6.2**
  - [ ]* 4.4 Write property test: SSRF-blocked URL never invokes `BrowserPool.getPage()`
    - **Property 1: SSRF policy always fires before Playwright**
    - **Validates: Requirements 3.1, 3.2**
  - [ ]* 4.5 Write property test: page is always closed after `browseWeb` resolves
    - **Property 2: Page is always closed**
    - **Validates: Requirements 1.6**
  - [ ]* 4.6 Write property test: `BrowseResult` shape invariant — required fields always present, `screenshotBase64` iff `screenshot=true` and success
    - **Property 12: BrowseResult shape invariant**
    - **Validates: Requirements 9.1, 9.2, 10.5, 12.3, 12.4**

- [ ] 5. Update `WebBrowser/src/policy.ts`
  - Add `application/json` to `ALLOWED_CONTENT_TYPES`
  - _Requirements: 4.3_

- [ ] 6. Update `WebBrowser/src/mcp-server.ts` with new optional Zod fields
  - Add `waitForSelector`, `waitForNetworkIdle`, `screenshot`, `cookies`, `outputFormat` to schema
  - Pass new fields through to `browseWeb`
  - _Requirements: 13.1–13.5_

- [ ] 7. Update `WebBrowser/src/index.ts` HTTP handler
  - Add new optional fields to `BrowseRequest` type
  - Pass them through to `browseWeb`
  - _Requirements: 12.1, 12.2_

- [ ] 8. Update `WebBrowser/src/browser.ts` types and env config
  - Expand `BrowseInput` with all v2.1.0 optional fields
  - Expand `BrowseResult` with `screenshotBase64?: string`
  - Read `BROWSER_DEFAULT_TIMEOUT_MS`, `BROWSER_MAX_TIMEOUT_MS`, `BROWSER_MAX_CONTENT_CHARS` env vars
  - _Requirements: 14.1–14.5_

- [ ] 9. Checkpoint — WebBrowser tests pass
  - Ensure existing `WebBrowser/tests/http.test.ts` and `policy.test.ts` pass without modification
  - Ensure all new property tests pass
  - _Requirements: 12.5_


---

## Feature 2: Skills Tool (New `Skills/` Workspace)

New monorepo workspace following the `RAG/` / `AskUser/` pattern.
MCP tool: `skills`. HTTP port: 3341. SQLite via `better-sqlite3`.

- [ ] 10. Scaffold `Skills/` workspace
  - Create `Skills/package.json` with same dependency set as `RAG/` (add `fast-check` to devDeps)
  - Create `Skills/tsconfig.json` mirroring `RAG/tsconfig.json`
  - Create `Skills/jest.config.js` mirroring `RAG/jest.config.js`
  - Create empty `Skills/src/` and `Skills/tests/` directories
  - Add `Skills` to root `package.json` workspaces array
  - _Requirements: 1.1, 1.2_

- [ ] 11. Define shared types in `Skills/src/types.ts`
  - Define `SkillRecord`, `SkillSummary`, `ParamSchema`, `Step`, `ResolvedStep` interfaces
  - Define `DefineSkillInput`, `ExecuteSkillInput`, `GetSkillInput`, `ListSkillsInput`, `DeleteSkillInput` types
  - _Requirements: 2.1, 3.1, 4.1, 5.1, 6.1_

- [ ] 12. Implement `Skills/src/store.ts` — SQLite persistence
  - [ ] 12.1 Write `SkillsStore` class with schema init (WAL mode, `skills` table, `idx_skills_name` index)
    - `upsertSkill`: insert with `version=1` on new name; update + increment version on existing name
    - `getSkillById`, `getSkillByName`, `listSkills(limit, offset)`, `deleteSkill(identifier)`, `close()`
    - Serialize `paramSchema` → `param_schema_json`, `steps` → `steps_json`
    - Read DB path from `SKILLS_DB_PATH` env var, default `./skills.db`
    - _Requirements: 7.1–7.6_
  - [ ]* 12.2 Write property test: upsert N times with same name yields `version = N`
    - **Property 2: Upsert version increment**
    - **Validates: Requirements 2.1, 2.2**
  - [ ]* 12.3 Write unit tests for `store.ts` using `:memory:` SQLite
    - Test CRUD, version increment, pagination, `deleteSkill` by name and id
    - _Requirements: 7.1–7.4_

- [ ] 13. Implement `Skills/src/policy.ts` — input validation
  - [ ] 13.1 Write `validateDefineSkill`, `validateExecuteSkill`, `validateGetSkill`, `validateListSkills`, `validateDeleteSkill`
    - Enforce kebab-case name pattern `/^[a-z0-9]+(-[a-z0-9]+)*$/`
    - Enforce description max 1000 chars, steps 1–100, step shape rules (prompt needs template, tool_call needs tool)
    - Enforce placeholder names match `/^\w+$/`
    - _Requirements: 2.4–2.8, 8.1–8.5_
  - [ ]* 13.2 Write property test: any non-kebab-case string returns `INVALID_INPUT`
    - **Property 3: Kebab-case rejection**
    - **Validates: Requirements 2.4, 8.1**
  - [ ]* 13.3 Write property test: description > 1000 chars returns `INVALID_INPUT`
    - **Property 4: Description length rejection**
    - **Validates: Requirements 2.6, 8.1**

- [ ] 14. Implement `Skills/src/skills.ts` — core logic
  - [ ] 14.1 Write `defineSkill`, `getSkill`, `listSkills`, `deleteSkill` delegating to `policy.ts` and `store.ts`
    - Return `ToolResponse<T>` envelopes from `@shared/types`
    - _Requirements: 2.1–2.8, 4.1–4.3, 5.1–5.6, 6.1–6.3, 9.1–9.5_
  - [ ] 14.2 Write `interpolate(template, params)` and `resolveSteps(steps, params)`
    - Replace all `{{key}}` tokens for keys present in params; leave unknown tokens unchanged
    - Do not mutate input steps array
    - _Requirements: 3.2, 3.3, 3.4, 3.5_
  - [ ] 14.3 Write `executeSkill` using `validateRequiredParams` + `resolveSteps`
    - Return `NOT_FOUND` if skill missing; `INVALID_INPUT` if required params absent
    - _Requirements: 3.1, 3.6, 3.7_
  - [ ]* 14.4 Write property test: resolved step array length always equals input step count
    - **Property 5: Step resolution length invariant**
    - **Validates: Requirements 3.1**
  - [ ]* 14.5 Write property test: all `{{key}}` tokens for keys in params are replaced; unknown tokens preserved
    - **Property 6: Interpolation replaces known tokens**
    - **Property 7: Unknown placeholders are preserved**
    - **Validates: Requirements 3.2, 3.3, 3.4**
  - [ ]* 14.6 Write property test: `get_skill` round-trip returns matching record
    - **Property 9: Get skill round-trip**
    - **Validates: Requirements 4.1, 4.2**
  - [ ]* 14.7 Write property test: `list_skills` with limit L returns at most L items
    - **Property 10: List skills pagination bound**
    - **Validates: Requirements 5.1, 5.2, 5.6**
  - [ ]* 14.8 Write property test: `delete_skill` then `get_skill` returns `NOT_FOUND`
    - **Property 11: Delete removes skill**
    - **Validates: Requirements 6.1, 6.2**

- [ ] 15. Implement `Skills/src/mcp-server.ts`
  - Register `skills` MCP tool with flat Zod input shape; `action` is only required field
  - Route `action` → `defineSkill | executeSkill | getSkill | listSkills | deleteSkill`
  - Set `isError: true` on `CallToolResult` for error responses
  - _Requirements: 10.1–10.5_

- [ ] 16. Implement `Skills/src/index.ts` — Express HTTP server on port 3341
  - `GET /health`, `GET /tool-schema`, `POST /tools/skills`
  - Map `errorCode` → HTTP status (NOT_FOUND→404, INVALID_INPUT→400, EXECUTION_FAILED→500)
  - Enable CORS
  - _Requirements: 1.2–1.5, 9.6–9.8_

- [ ] 17. Write `Skills/tests/http.test.ts` and `Skills/tests/mcp.test.ts`
  - HTTP: all 5 actions via supertest, error status codes, health + schema endpoints
  - MCP: in-process transport, `CallToolResult` shape, `isError` flag
  - _Requirements: 1.1–1.5, 9.6–9.8_

- [ ] 18. Checkpoint — Skills tests pass
  - Ensure all `Skills/tests/` tests pass with `:memory:` SQLite
  - Ensure property tests pass


---

## Feature 3: ECM Tool (New `ECM/` Workspace)

New monorepo workspace following the `RAG/` pattern.
MCP tool: `ecm`. HTTP port: 3342. SQLite + vector embeddings via LM Studio.

- [ ] 19. Scaffold `ECM/` workspace
  - Create `ECM/package.json` with same dependency set as `RAG/` (add `fast-check` to devDeps)
  - Create `ECM/tsconfig.json` and `ECM/jest.config.js` mirroring `RAG/`
  - Create empty `ECM/src/` and `ECM/tests/` directories
  - Add `ECM` to root `package.json` workspaces array
  - _Requirements: 11.1, 12.1_

- [ ] 20. Define shared types in `ECM/src/types.ts`
  - Define `SegmentRecord`, `SegmentType`, `StoreSegmentInput`, `RetrieveContextInput`, `RetrieveResult`, `ScoredSegment`, `ListSegmentsInput`, `ListSegmentsResult`, `SummarizeSessionInput`, `SummarizeResult`, `DeleteSegmentInput`, `ClearSessionInput` interfaces
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1_

- [ ] 21. Implement `ECM/src/embeddings.ts` — embedding provider
  - Re-export or copy `EmbeddingProvider` pattern from `RAG/src/embeddings.ts`
  - Substitute `ECM_EMBEDDING_MODEL` and `ECM_EMBEDDINGS_MODE` env vars
  - Support `mock` mode returning deterministic embeddings for tests
  - _Requirements: 15.1–15.4_

- [ ] 22. Implement `ECM/src/store.ts` — SQLite persistence
  - [ ] 22.1 Write `ECMStore` class with schema init (WAL mode, `ecm_segments` table + 3 indexes)
    - `insertSegment`, `getSegmentById`, `getSegmentsBySession`, `getOldestNonSummarySegments`, `listSegments`, `deleteSegment`, `deleteSegmentsByIds`, `clearSession`, `close()`
    - Store `embedding` as `embedding_json TEXT`, `metadata` as `metadata_json TEXT`
    - Read DB path from `ECM_DB_PATH` env var
    - _Requirements: 14.1–14.5_
  - [ ]* 22.2 Write unit tests for `store.ts` using `:memory:` SQLite
    - Test `getOldestNonSummarySegments` ordering, `deleteSegmentsByIds` atomicity, session isolation at query level
    - _Requirements: 13.3, 14.1–14.3_

- [ ] 23. Implement `ECM/src/policy.ts` — input validation
  - Write `validateStoreSegment`, `validateRetrieveContext`, `validateListSegments`, `validateDeleteSegment`, `validateClearSession`, `validateSummarizeSession`
  - Enforce required fields, importance range `[0,1]`, segment type enum, non-empty strings
  - Pure functions — no I/O
  - _Requirements: 10.1–10.4_

- [ ] 24. Implement core scoring and summarization in `ECM/src/ecm.ts`
  - [ ] 24.1 Write `computeScore(segment, queryEmbedding, now)` using composite formula
    - `score = (cosine * 0.7) + (importance * 0.2) + (recency * 0.1)`
    - `recencyScore = 1 / (1 + ageInHours)`
    - Return finite number; handle dimension mismatch gracefully
    - _Requirements: 7.1–7.4_
  - [ ]* 24.2 Write property test: `computeScore` returns finite number; recency strictly decreasing with age
    - **Property 3: Composite Score Bounds**
    - **Property 6: Recency Score Monotonically Decreasing with Age**
    - **Validates: Requirements 7.1–7.4_**
  - [ ] 24.3 Write `extractiveSummarize(segments)` — purely extractive, no LLM
    - Score sentences by position + length + segment importance heuristics
    - Select top sentences up to `min(segments.length * 200, 2000)` char budget
    - Re-order selected sentences by original position before joining
    - _Requirements: 8.1–8.4_
  - [ ]* 24.4 Write property test: `extractiveSummarize` output is non-empty and length ≤ `min(N*200, 2000)`
    - **Property 9: Extractive Summarizer Output Bounded**
    - **Validates: Requirements 8.1, 8.2**

- [ ] 25. Implement ECM operations in `ECM/src/ecm.ts`
  - [ ] 25.1 Write `storeSegment`: validate → embed → compute tokenCount → insert; atomic (no partial write on embed failure)
    - Default `importance` to `0.5`; `tokenCount = Math.ceil(content.length / 4)`
    - _Requirements: 1.1–1.7_
  - [ ]* 25.2 Write property test: store round-trip — returned record matches input fields and tokenCount formula
    - **Property 8: Store Segment Round-Trip**
    - **Property 4: Token Count Consistency**
    - **Validates: Requirements 1.1, 9.1, 9.2**
  - [ ]* 25.3 Write property test: embedding failure leaves no partial segment in store
    - **Property 10: Embedding Failure Prevents Partial Write**
    - **Validates: Requirements 1.7**
  - [ ] 25.4 Write `retrieveContext`: embed query → score all session segments → sort desc → apply topK → enforce maxTokens budget
    - Set `truncated: true` when budget excludes segments; filter by `minScore` when provided
    - Default `maxTokens=4096`, `topK=10`
    - _Requirements: 2.1–2.10_
  - [ ]* 25.5 Write property test: `result.totalTokens <= maxTokens` for any segment set and any maxTokens
    - **Property 2: Token Budget Never Exceeded**
    - **Validates: Requirements 2.2**
  - [ ]* 25.6 Write property test: result segments sorted by score descending
    - **Property 7: Retrieve Context Sorted by Score Descending**
    - **Validates: Requirements 2.1**
  - [ ] 25.7 Write `listSegments`, `deleteSegment`, `clearSession` delegating to store
    - `clearSession` must not affect other sessions
    - _Requirements: 3.1–3.5, 4.1–4.3, 5.1–5.3_
  - [ ]* 25.8 Write property test: session isolation — segments stored under session A never appear in session B retrieval
    - **Property 1: Session Isolation**
    - **Property 11: Clear Session Isolation**
    - **Validates: Requirements 13.1, 13.2, 13.3, 2.10**
  - [ ] 25.9 Write `summarizeSession`: get oldest non-summary segments → extractiveSummarize → embed → insert summary → delete originals (transactional)
    - Set summary `importance=0.8`; return early with `INVALID_INPUT` if fewer than 2 segments to summarize
    - _Requirements: 6.1–6.8_
  - [ ]* 25.10 Write property test: after `summarizeSession`, original segments gone and exactly one summary inserted
    - **Property 5: Summarize Session Destructive-Then-Constructive**
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [ ] 26. Implement `ECM/src/mcp-server.ts`
  - Register `ecm` MCP tool with flat Zod input shape; `action` is only required field
  - Route all 6 actions; set `isError: true` on error responses
  - _Requirements: 12.1–12.4_

- [ ] 27. Implement `ECM/src/index.ts` — Express HTTP server on port 3342
  - `GET /health`, `GET /tool-schema`, `POST /tools/ecm`
  - Map error codes to HTTP status; enable CORS
  - _Requirements: 11.1–11.6_

- [ ] 28. Write `ECM/tests/http.test.ts` and `ECM/tests/mcp.test.ts`
  - HTTP: all 6 actions via supertest, error status codes, health + schema endpoints
  - MCP: in-process transport, `CallToolResult` shape
  - Use `:memory:` SQLite and `ECM_EMBEDDINGS_MODE=mock`
  - _Requirements: 11.1–11.6, 12.1–12.4_

- [ ] 29. Checkpoint — ECM tests pass
  - Ensure all `ECM/tests/` tests pass
  - Ensure all property tests pass


---

## Feature 4: Version Bump and Integration (v2.1.0)

Wire all three new workspaces into the monorepo build, config, and documentation.

- [ ] 30. Update root `package.json` for v2.1.0
  - Bump `"version"` from `"2.0.1"` to `"2.1.0"`
  - Add `Skills` and `ECM` to `workspaces` array (if not already done in tasks 10/19)
  - Add `Skills` and `ECM` build steps to `build:tools` script
  - Add `Skills` and `ECM` clean steps to `clean:tools` script
  - _Requirements: all three features — integration_

- [ ] 31. Update `scripts/workspace/mcp-config.js`
  - Add `skills` server entry: `relativeScript: "Skills/dist/mcp-server.js"`, env `SKILLS_DB_PATH`
  - Add `ecm` server entry: `relativeScript: "ECM/dist/mcp-server.js"`, env `ECM_DB_PATH`, `ECM_EMBEDDINGS_MODE`, `ECM_EMBEDDING_MODEL`
  - Update `web-browser` entry env to include `BROWSER_HEADLESS` and `BROWSER_EXECUTABLE_PATH`

- [ ] 32. Update `docs/ARCHITECTURE.md`
  - Add `WebBrowser` row note: upgraded to Playwright headless Chromium in v2.1.0
  - Add `Skills` row: port 3341, status ✅ Working
  - Add `ECM` row: port 3342, status ✅ Working
  - Update "Last Updated" date and version to `2.1.0`

- [ ] 33. Update root `README.md`
  - Add `Skills` and `ECM` to the tool inventory section
  - Note Playwright upgrade for `WebBrowser`
  - Add `npx playwright install chromium` to WebBrowser setup instructions

- [ ] 34. Final checkpoint — full build and test suite
  - Ensure `npm run build` succeeds for all workspaces including `Skills` and `ECM`
  - Ensure `npm test` passes across all workspaces (80%+ coverage gates)
  - Ensure `npm run type-check` passes with no errors
  - Ensure `npm run check:ci` (Biome) passes with no errors

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests use `fast-check`; unit tests use Jest with supertest for HTTP
- All new SQLite-backed tests use `:memory:` path and `ECM_EMBEDDINGS_MODE=mock` / `SKILLS_DB_PATH=:memory:`
- Each task references specific requirements for traceability
- Checkpoints (tasks 9, 18, 29, 34) ensure incremental validation before moving to the next feature
