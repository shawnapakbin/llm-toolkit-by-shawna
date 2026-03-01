# Robust Coding Agent Roadmap (Phase 1 → Phase 3)

This plan is tailored to the current LM Studio Tools workspace:
- Terminal
- WebBrowser
- Calculator
- Clock
- Browserless

## Success Criteria
- Agent can reliably plan, execute, validate, and recover.
- Tool calls are safe by default.
- Every run is observable and debuggable.
- New tools can be added without breaking existing MCP setup.

---

## Phase 1 — Foundation + Safety ✅ COMPLETE

### 1) Unified Tool Contracts ✅
- [x] Standardize tool response envelope for all tools:
  - `success`, `errorCode`, `errorMessage`, `data`, `timingMs`, `traceId`
- [x] Add consistent input validation errors (`INVALID_INPUT`, `TIMEOUT`, `POLICY_BLOCKED`, `EXECUTION_FAILED`)
- [x] Ensure MCP and HTTP return equivalent payload semantics

**Acceptance**: Same request gets equivalent structure from HTTP and MCP paths.

### 2) Terminal Hardening ✅
- [x] Add command allowlist mode (default on)
- [x] Add deny patterns for destructive commands (format/del/rm -rf/network exfil)
- [x] Restrict `cwd` to workspace subtree (no parent traversal)
- [x] Add max stdout/stderr truncation with explicit truncation markers

**Acceptance**: Unsafe commands are blocked with `POLICY_BLOCKED` and audit metadata.

### 3) WebBrowser Hardening ✅
- [x] Enforce URL allow/deny policy (block localhost/private ranges by default)
- [x] Add content-type checks and max download bytes guard
- [x] Add redirect limit and protocol restrictions (`http/https` only)
- [x] Add explicit SSRF error codes

**Acceptance**: Disallowed/internal URLs fail fast and never fetch content.

### 4) Calculator Reliability ✅
- [x] Keep symbol normalization map versioned and test-covered
- [x] Add clearer unit mismatch hints in error payload
- [x] Add deterministic formatting options (`fixed`, `scientific`, `auto`)

**Acceptance**: `sin(30°)`, `sin(π/6)`, superscripts, and engineering prefixes pass consistently.

### 5) Browserless Hardening ✅
- [x] Add API key validation and rotation support in environment
- [x] Add concurrency limiting to prevent quota exhaustion (default: 5 concurrent requests)
- [x] Add region failover logic for multi-region deployment
- [x] Add CAPTCHA solve failure handling and fallback strategies
- [x] Add screenshot/PDF timeout guards for large pages

**Acceptance**: Concurrent requests queue when limit reached vs. failing immediately.

---

## Phase 2 — Orchestration + Workflow Execution

### 6) Agent Runner (Local)
- [ ] Create a lightweight orchestrator service that can:
  - select tool
  - call tool
  - validate output
  - retry with fallback policy
- [ ] Add step graph execution (sequential + limited parallel)
- [ ] Add per-step timeout and cancellation propagation

**Acceptance**: Multi-step tasks complete with retries and partial-failure handling.

### 7) Task Planning + Memory
- [ ] Add short-lived run memory (context for one session)
- [ ] Add persistent run history store (SQLite)
- [ ] Add retrieval of prior successful tool patterns

**Acceptance**: Agent can reuse prior solution traces for similar prompts.

### 8) Tool Registry
- [ ] Central registry of tools and capabilities (`read`, `execute`, `compute`)
- [ ] Health checker that validates all MCP entrypoints exist before session start
- [ ] Version each tool schema and surface compatibility warnings

**Acceptance**: Broken tool paths are detected before user chat execution.

---

## Phase 3 — Observability + Eval + Operations

### 9) Observability
- [ ] Add structured logs across all tools (`traceId`, `toolName`, `durationMs`, `status`)
- [ ] Add local metrics export (JSON or Prometheus text format)
- [ ] Add run-level trace timeline (plan → tool calls → output)

**Acceptance**: Each agent run can be reconstructed from logs and metrics.

### 10) Evaluation Harness
- [ ] Build regression suite of coding-agent tasks:
  - file edit task
  - shell build task
  - web retrieval + summarize task
  - math/engineering compute task
- [ ] Track pass rate, retries, and failure categories
- [ ] Add "golden traces" for stable benchmark runs

**Acceptance**: Changes are blocked if regression pass rate drops below threshold.

### 11) Workspace Operations
- [ ] Add root task(s) to build/test all tools together
- [ ] Add startup script to verify MCP binaries + env before LM Studio use
- [ ] Keep top-level `mcp.json` block synchronized when tools are added

**Acceptance**: One command validates readiness of Terminal, WebBrowser, Calculator, Clock, Browserless.

---

## Immediate Next 15 Tasks (Execution Order)
1. Add shared response envelope to Terminal/WebBrowser/Calculator/Clock/Browserless.
2. Add policy error codes and normalize all failures.
3. Implement Terminal allowlist + cwd sandbox.
4. Implement WebBrowser SSRF/private-network protections.
5. Add Calculator unit-mismatch error hints.
6. Add Browserless API key validation + rotation support.
7. Add Browserless region failover + health checks.
8. Add root `verify-tools` task (checks all `dist/mcp-server.js` paths).
9. Add root `build-all-tools` task.
10. Add structured logging fields (`traceId`, `durationMs`) across all tools.
11. Create SQLite run-history store.
12. Add Browserless-specific regression tests (screenshot, PDF, scrape, unblock).
13. Create multi-tool integration tests (file + web + browser automation).
14. Add concurrency metrics and load testing harness.
15. Create comprehensive golden traces for stable benchmark runs.

---

## MCP Governance Rule
Whenever a new tool is added:
1. Add the tool folder and MCP server.
2. Build and verify `dist/mcp-server.js` exists.
3. Update main README `mcp.json` block (including environment variables).
4. Add tool-specific hardening section in Phase 1 (policy, timeout, quota controls).
5. Add tool-specific regression tests in Phase 3 evaluation suite.
6. Run `verify-tools` before using LM Studio.
