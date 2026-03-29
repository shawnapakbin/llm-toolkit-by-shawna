# vNext Feature Manifest

Purpose: This file marks intentional enhancements that belong to the upcoming release scope so they are not mistaken for unrelated drift during hardening or review.

Release target: `v2.1.0`
Status: `release-hardening`
Owner: `core-maintainers`

## Included vNext Features

1. `AskUser` tool
- Scope: async interview workflow for planning and approval collection.
- Key paths: `AskUser/`.

2. `RAG` tool
- Scope: persistent ingestion/retrieval with source lifecycle and approval-gated writes.
- Key paths: `RAG/`.

3. `Terminal` punchout mode
- Scope: visible terminal window execution and terminal session reuse.
- Key paths: `Terminal/src/punchout.ts`, `Terminal/src/index.ts`, `Terminal/src/mcp-server.ts`, `Terminal/tests/http.test.ts`.

4. Shared package and tool call normalization
- Scope: standardize shared package identity, imports, and canonical tool call schema for all tools and workflows.
- Key paths: `shared/package.json`, `shared/types.ts`, `shared/toolCallNormalizer.ts`, normalization logic in MCP server and workflow runner.

5. MCP config and sync enhancements
- Scope: centralized MCP server config generation and LM Studio bridge sync.
- Key paths: `scripts/workspace/mcp-config.js`, `scripts/workspace/sync-lmstudio-bridge-configs.js`, `scripts/workspace/generate-mcp-config.js`.

6. Evaluation harness hardening
- Scope: expected-success semantics for negative tests and baseline/drift support.
- Key paths: `testing/evaluation/`.

## Documentation

| Document | Purpose |
|----------|---------|
| [Browserless/README.md](../Browserless/README.md) | Browserless MCP tool usage, schemas, and troubleshooting |

## Marking Rules (Going Forward)

1. Any release-scoped feature must be listed in this file before merge.
2. PR titles for these items should use prefix: `feat(vnext): ...`.
3. Commits that only harden vNext functionality should use prefix: `chore(vnext-hardening): ...`.
4. If scope changes, update this file and `docs/RELEASE_CHECKLIST.md` in the same PR.

## Out Of Scope For v2.1.0

- Unlisted new tool directories.
- Major schema rewrites not tied to listed features.
- Breaking API changes without explicit migration notes.
