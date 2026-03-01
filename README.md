# LM Studio Tools

This workspace contains local tools for LM Studio.

See implementation roadmap: [AGENT_ROADMAP.md](AGENT_ROADMAP.md)
# LLM Toolkit by Shawna

**Version**: 2.0.0-alpha.1  
**Status**: Phase 0 (Foundation) ✅ Complete

Enterprise-grade LLM software engineer agent with multi-tool orchestration, SQL-backed memory, and unified quality gates.

**GitHub**: https://github.com/shawnapakbin/llm-toolkit-by-shawna

## Quick Start

### Installation

```bash
git clone https://github.com/shawnapakbin/llm-toolkit-by-shawna.git
cd llm-toolkit-by-shawna
npm install
npm run build
```

### Verify Setup

```bash
npm run check:ci     # Biome format + lint
npm run type-check   # TypeScript strict mode
npm test:ci          # Jest tests (80%+ coverage)
```

## Architecture

### 5 Core Tools (v1 → v2 compatibility maintained)

- **[Terminal](Terminal/README.md)** — Execute shell commands (OS-aware: Windows/macOS/Linux) ✅
- **[WebBrowser](WebBrowser/README.md)** — Fetch + parse web pages (SSRF-protected) ✅
- **[Calculator](Calculator/README.md)** — Math expressions (engineering notation, symbol normalization) ✅
- **[Clock](Clock/README.md)** — Date/time + timezones (IANA + locale formatting) ✅
- **[Browserless](Browserless/README.md)** — Advanced browser automation (screenshots, PDFs, BrowserQL) ✅

### Foundation Layer (Phase 0 ✅)

- **[Biome](biome.json)** — Unified code formatting + linting (1-sec CI runs)
- **[Jest](jest.config.ts)** — Test harness with 80% coverage gates
- **[SQLite Memory](Memory/)** — Task history, solution patterns, learned rules
- **CI/CD Gates** — `.github/workflows/ci.yml` enforces quality on every PR

### Phase 1–3 Roadmap (In progress)

- Phase 1: Tool hardening + quality gates (1.5 weeks)
- Phase 2: 6 new tools (Git, FileEditor, PackageManager, BuildRunner, AIModel, Observability) (6 weeks)
- Phase 3: Agent orchestrator + pattern replay (1 week)
- Phase 4: Multi-interface launchers (LM Studio, CLI, VS Code, HTTP) (0.5 weeks)

See [AGENT_ROADMAP.md](AGENT_ROADMAP.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

## Code Quality

### Quality Gates (Every PR)

```bash
npm run check:ci       # Biome: format + lint ✓
npm run type-check     # TypeScript strict mode ✓
npm run test:ci        # Jest: 80%+ coverage ✓
npm run build          # Compilation check ✓
```

### Standards

- **Test Coverage**: 80% minimum (Terminal: 85%, Calculator: 90%)
- **Type Safety**: `strict: true`, no `any` types
- **Code Style**: Biome (2-space indent, 100-char lines, trailing commas)
- **Documentation**: JSDoc on all exports, architecture docs for design changes
- **Performance**: SLA benchmarks (Terminal < 10s, WebBrowser < 20s, Calculator < 1s)

See [docs/CODE-QUALITY.md](docs/CODE-QUALITY.md) for full standards.

## Development

### Before Making Changes

1. Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
2. Read [CONTRIBUTING.md](CONTRIBUTING.md)
3. Create feature branch: `git checkout -b feat/description`

### Workflow

```bash
# Make changes to src/
npm run format        # Auto-fix formatting
npm run lint          # Auto-fix linting
npm run type-check    # Verify type safety
npm test              # Run tests locally (watch mode)
npm run check         # Final pre-commit check
git add .
git commit -m "feat(Tool): description"
git push origin feat/description
# Create pull request
```

## Deployment

### LM Studio Integration (v1 Configuration)

Update your LM Studio `mcp.json`:

## Complete `mcp.json` Example

```json
{
	"mcpServers": {
		"terminal": {
			"command": "node",
			"args": ["C:/Users/YOUR_USERNAME/Development/llm-toolkit/Terminal/dist/mcp-server.js"],
			"env": {
				"TERMINAL_DEFAULT_TIMEOUT_MS": "60000",
				"TERMINAL_MAX_TIMEOUT_MS": "120000"
			}
		},
		"web-browser": {
			"command": "node",
			"args": ["C:/Users/YOUR_USERNAME/Development/llm-toolkit/WebBrowser/dist/mcp-server.js"],
			"env": {
				"BROWSER_DEFAULT_TIMEOUT_MS": "20000",
				"BROWSER_MAX_TIMEOUT_MS": "60000",
				"BROWSER_MAX_CONTENT_CHARS": "12000"
			}
		},
		"calculator": {
			"command": "node",
			"args": ["C:/Users/YOUR_USERNAME/Development/llm-toolkit/Calculator/dist/mcp-server.js"],
			"env": {
				"CALCULATOR_DEFAULT_PRECISION": "12",
				"CALCULATOR_MAX_PRECISION": "20"
			}
		},
		"clock": {
			"command": "node",
			"args": ["C:/Users/YOUR_USERNAME/Development/llm-toolkit/Clock/dist/mcp-server.js"],
			"env": {
				"CLOCK_DEFAULT_TIMEZONE": "",
				"CLOCK_DEFAULT_LOCALE": "en-US"
			}
		},
		"browserless": {
			"command": "node",
			"args": ["C:/Users/YOUR_USERNAME/Development/llm-toolkit/Browserless/dist/mcp-server.js"],
			"env": {
				"BROWSERLESS_API_KEY": "your-browserless-api-token-here",
				"BROWSERLESS_DEFAULT_REGION": "production-sfo",
				"BROWSERLESS_DEFAULT_TIMEOUT_MS": "30000",
				"BROWSERLESS_MAX_TIMEOUT_MS": "120000",
				"BROWSERLESS_CONCURRENCY_LIMIT": "5"
			}
		}
	}
}
```

```

**Note**: Update paths to match your installation directory.  
Phase 2 will introduce unified orchestrator MCP server and multi-interface launchers.

## Testing & CI/CD

### Local Testing

```bash
npm test              # Run all tests (watch mode)
npm run test:ci       # CI mode (coverage report)
npm run benchmark     # Performance SLA checks
```

### GitHub Actions

Automated on every push/PR:
- Biome format + lint check
- TypeScript compilation + type check
- Jest test suite + coverage threshold
- Build verification

## Memory System

The SQLite-backed memory store enables:

- **Task Reuse**: Replay proven solution patterns for similar prompts
- **Decision Tracking**: Audit why tool X was chosen over Y
- **Failure Learning**: Capture what didn't work for backtracking
- **Rule Learning**: SSRF blocks, command denylists discovered during execution

See [Memory/README.md](Memory/README.md) for details.

## Documentation

| Document | Purpose |
|----------|---------|
| [AGENT_ROADMAP.md](AGENT_ROADMAP.md) | Implementation phases + progress |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design + patterns |
| [docs/CODE-QUALITY.md](docs/CODE-QUALITY.md) | Quality standards + benchmarks |
| [CONTRIBUTING.md](CONTRIBUTING.md) | PR workflow + code review checklist |
| [Memory/README.md](Memory/README.md) | Memory persistence API |

## Features & Status

| Feature | Status | Notes |
|---------|--------|-------|
| 5 core tools | ✅ | Terminal, WebBrowser, Calculator, Clock, Browserless |
| Biome format + lint | ✅ | CI gate, auto-fix on save |
| Jest test suite | ✅ | 80% coverage minimum |
| SQLite memory | ✅ | Task history, patterns, rules |
| GitHub Actions CI | ✅ | Biome + lint + test + build |
| Tool hardening (Phase 1) | 🔄 | Command denylist, SSRF blocking, output truncation |
| New tools (Phase 2) | 🔄 | Git, FileEditor, PackageManager, BuildRunner, AIModel, Observability |
| Agent orchestrator (Phase 3) | 🔄 | Multi-step task planning + pattern replay |
| Multi-interface launchers (Phase 4) | 🔄 | LM Studio + CLI + VS Code + HTTP |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Development setup
- Code review checklist
- Adding new tools
- Reporting issues

## License

MIT — See LICENSE file

## Contact

**GitHub**: [@shawnapakbin](https://github.com/shawnapakbin)  
**Repository**: https://github.com/shawnapakbin/llm-toolkit-by-shawna

---

**Last Updated**: March 1, 2026  
Built with ❤️ for LLM-powered software engineering
