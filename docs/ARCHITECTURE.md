# LLM Toolkit by Shawna — Architecture Guide

## System Overview

**LLM Toolkit by Shawna** is an enterprise-grade agent framework designed to orchestrate multiple specialized tools for software engineering tasks. The system is built on three pillars:

1. **Tool Isolation** — Each tool (Terminal, WebBrowser, Calculator, etc.) runs independently with strict contracts
2. **Memory Persistence** — SQLite-backed task history, solution patterns, and learned rules for intelligent decision-making
3. **Dual Server Architecture** — Both HTTP (Express) and MCP (Model Context Protocol) interfaces for maximum integration flexibility

---

## Core Patterns

### 1. Tool Contract Pattern

Every tool follows a standardized input/output contract:

**Input**: Zod-validated parameters (type-safe, documented)
```typescript
const schema = z.object({
  command: z.string().min(1),
  timeoutMs: z.number().positive().optional(),
});
```

**Output**: Standardized response envelope (consistency across all tools)
```typescript
{
  success: boolean,
  data?: T,
  error?: { code: ErrorCode, message: string, details?: {} },
  timing: { durationMs: number, startTime: string },
  traceId: string  // For observability + memory linking
}
```

### 2. Dual Server Pattern

Each tool exposes both interfaces:

- **HTTP Server (Express)**
  - `GET /health` — Liveness check
  - `GET /tool-schema` — Tool contract (for clients)
  - `POST /tools/{tool_name}` — Tool invocation

- **MCP Server (Stdio)**
  - Registers tools with McpServer
  - Same handler logic as HTTP (no duplication)
  - Used by LM Studio, Claude, other MCP clients

### 3. Hardening Pattern

Safety-first approach:

- **Deny Patterns** — Explicit denylists for dangerous operations (Terminal: `rm -rf`, WebBrowser: `localhost`)
- **Sandbox** — Restrict resource access (Terminal: cwd to workspace, WebBrowser: block private IPs)
- **Truncation** — Limit output size to prevent token overflow (Terminal: 50KB stdout limit)
- **Error Codes** — Standardized error reporting (`INVALID_INPUT`, `TIMEOUT`, `POLICY_BLOCKED`, `EXECUTION_FAILED`)

### 4. Agent Loop Pattern

Orchestrator drives multi-step tasks:

```
1. Plan: Break prompt into tool calls (use Claude)
2. Execute: Run tools sequentially with retries
3. Memory: Look for similar past solutions (reuse patterns)
4. Observe: Log decisions, failures, outcomes
5. Learn: Update rules, record successful patterns
```

### 5. Memory Persistence Pattern

SQLite tables capture agent intelligence:

- **task_runs** — History of all agent executions
- **tool_calls** — Audit trail of every tool invocation
- **solution_patterns** — Reusable successful task traces (avoid re-planning)
- **learned_rules** — SSRF blocks, command denylists, constraints
- **agent_decisions** — Rationale for tool selections (explainability)
- **failed_attempts** — What didn't work (backtracking + learning)

---

## Tool Inventory

| Tool | Purpose | Port | Status |
|------|---------|------|--------|
| **Terminal** | Execute shell commands (OS-aware) | 3333 | ✅ Working |
| **WebBrowser** | Fetch + parse web pages | 3334 | ✅ Working |
| **Calculator** | Math expressions (engineering notation) | 3335 | ✅ Working |
| **Clock** | Current date/time + timezone | 3337 | ✅ Working |
| **Browserless** | Advanced browser automation (BrowserQL, screenshots, PDFs) | 3003 | ✅ Working |
| **Git** (Phase 2) | Clone, commit, branch, merge | TBD | 🔄 Planned |
| **FileEditor** (Phase 2) | Safe read/write code files | TBD | 🔄 Planned |
| **PackageManager** (Phase 2) | npm/pip/cargo detection + install/update | TBD | 🔄 Planned |
| **BuildRunner** (Phase 2) | Compile, test, lint | TBD | 🔄 Planned |
| **AIModel** (Phase 2) | In-agent Claude/OpenAI calls | TBD | 🔄 Planned |
| **Observability** (Phase 2) | Logging, metrics, tracing | TBD | 🔄 Planned |
| **Orchestrator** (Phase 3) | Master agent runner | N/A | 🔄 Planned |

---

## Code Quality Standards

### Test Coverage
- **Minimum**: 80% statement coverage per tool
- **Terminal**: 85% (critical safety)
- **Calculator**: 90% (deterministic)
- **Browserless**: 70% (external API dependency)

### Type Safety
- **Strict TypeScript**: All tools use `strict: true`
- **No `any` types**: Use `unknown` with type guards
- **JSDoc required**: All exported functions documented

### Code Style
- **Biome**: Unified formatting + linting (1-sec CI runs)
- **No manual review needed**: Biome fixes auto-apply

### Performance SLAs
- **Terminal**: < 10 seconds (default timeout)
- **WebBrowser**: < 20 seconds (network latency)
- **Calculator**: < 1 second
- **Clock**: < 100 milliseconds
- **Browserless**: < 30 seconds

---

## Security Model

### Threat: Arbitrary Command Execution

**Mitigation**: Command allowlist/denylist (Terminal)
```typescript
const DENY_PATTERNS = [
  /rm -rf/,
  /format /,
  /mkfs/,
  /ssh.*-p\d+/      // Network exfil
];
```

**Acceptance**: Unsafe commands blocked with `POLICY_BLOCKED` error code + audit metadata

### Threat: SSRF (Server-Side Request Forgery)

**Mitigation**: Private IP blocking (WebBrowser)
```typescript
const BLOCKED = [
  /localhost|127\.0\.0\.1/,
  /10\.\d+\.\d+\.\d+/,
  /192\.168\.\d+\.\d+/,
  /172\.(16-31)\.\d+\.\d+/
];
```

**Acceptance**: Private URLs fail fast with clear SSRF error code

### Threat: Unbounded Resource Use

**Mitigation**: Timeouts + concurrency limits
- Terminal: 120 second max timeout
- WebBrowser: 60 second max timeout
- Browserless: 5 concurrent requests (queue beyond)

---

## Deployment Targets

### LM Studio (MCP Protocol)
```json
{
  "mcpServers": {
    "llm-toolkit": {
      "command": "node",
      "args": ["dist/lm-studio-runner.js"]
    }
  }
}
```

### VS Code Extension (Copilot Chat integration)
- Right-click context: "Fix with Agent", "Generate Tests"
- Inline suggestions + code actions

### CLI Agent
```bash
npx llm-engineer --task "fix the failing test in src/math.test.ts"
```

### HTTP API Gateway
```bash
curl -X POST http://localhost:3000/api/v1/execute-task \
  -d '{"prompt": "...", "sessionId": "..."}'
```

---

## Development Workflow

### 1. Add a New Tool

```bash
mkdir MyTool
cp -r Terminal/. MyTool/
# Edit MyTool/src/index.ts (HTTP handler)
# Edit MyTool/src/mcp-server.ts (MCP registration)
# Create MyTool/tests/ (85%+ coverage required)
npm install -w MyTool
npm run build
npm test
```

### 2. Hardening Review (Phase 1)

Before shipping a tool, verify:
- ✅ No `POLICY_BLOCKED` FPs (false denials on legitimate commands)
- ✅ All hardening tests pass
- ✅ Performance SLA met
- ✅ Error codes consistent with other tools

### 3. Memory Integration

If tool creates side effects or makes decisions:
```typescript
await memory.recordToolCall(taskRunId, toolName, input, output, success);
await memory.recordDecision(taskRunId, step, "chose tool X because...", alternatives);
```

---

## Key Files

| File | Purpose |
|------|---------|
| `biome.json` | Code format + linting config |
| `jest.config.ts` | Test harness (80% coverage gates) |
| `tsconfig.json` | TypeScript strict mode |
| `.github/workflows/ci.yml` | CI gates (Biome + Jest + type-check + build) |
| `Memory/src/index.ts` | SQLite persistence layer |
| `testing/test-utils.ts` | Shared test helpers |
| `testing/responses.ts` | Standard response envelope |
| `docs/CODE-QUALITY.md` | Detailed quality standards |
| `docs/MEMORY-PATTERNS.md` | Memory query patterns |
| `CONTRIBUTING.md` | PR workflow + checklist |

---

**Last Updated**: March 1, 2026  
**Version**: 2.0.0-alpha.1
