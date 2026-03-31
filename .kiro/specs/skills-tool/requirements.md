# Requirements Document

## Introduction

The Skills Tool is a persistent, reusable skill/playbook system exposed as an MCP tool (`skills`) via stdio and an HTTP Express server on port 3341. Agents define named skills — each a parameterized template with a description, a JSON Schema for parameters, and an ordered sequence of steps (prompt templates or tool call descriptors). Skills survive process restarts via SQLite. The agent executes a skill by name, passing parameters, and receives the fully resolved step sequence ready for execution. The workspace follows the established monorepo pattern (`Skills/`) with the same file layout as `RAG/` and `AskUser/`.

## Glossary

- **Skills_Tool**: The MCP tool and HTTP service that manages and executes skill definitions.
- **Skill**: A named, versioned, parameterized playbook consisting of an ordered sequence of steps.
- **SkillRecord**: The full persisted representation of a skill, including id, name, description, paramSchema, steps, version, created_at, and updated_at.
- **SkillSummary**: A lightweight projection of a SkillRecord used in list responses, containing id, name, description, stepCount, version, and updatedAt.
- **Step**: A single unit in a skill's sequence — either a `prompt` step (with a template string) or a `tool_call` step (with a tool name and args map).
- **ResolvedStep**: A Step with all `{{paramName}}` placeholders substituted with concrete parameter values.
- **ParamSchema**: A JSON Schema object (`type: 'object'`) describing the parameters a skill accepts, including which are required.
- **SkillsStore**: The `store.ts` module responsible for all SQLite reads and writes.
- **Policy**: The `policy.ts` module responsible for pure input validation with no I/O.
- **MCP_Server**: The `mcp-server.ts` module that registers the `skills` MCP tool and routes calls to core logic.
- **HTTP_Server**: The Express server in `index.ts` that exposes skill operations over HTTP on port 3341.
- **interpolate**: The function that replaces `{{paramName}}` tokens in a string with values from a params map.
- **upsert**: An insert-or-update operation keyed on skill name; increments version on update.

---

## Requirements

### Requirement 1: MCP and HTTP Server Exposure

**User Story:** As an LLM agent, I want to interact with the Skills Tool via both MCP stdio and HTTP, so that I can use it from any integration context.

#### Acceptance Criteria

1. THE `MCP_Server` SHALL register a tool named `skills` accessible via stdio MCP transport.
2. THE `HTTP_Server` SHALL listen on port 3341.
3. THE `HTTP_Server` SHALL expose a `POST /tools/skills` endpoint that accepts all five skill actions.
4. THE `HTTP_Server` SHALL expose a `GET /health` endpoint that returns HTTP 200.
5. THE `HTTP_Server` SHALL expose a `GET /tool-schema` endpoint that returns the MCP tool schema.

---

### Requirement 2: Skill Definition (define_skill)

**User Story:** As an LLM agent, I want to define and update named skills with parameterized step sequences, so that I can build reusable playbooks that persist across sessions.

#### Acceptance Criteria

1. WHEN `define_skill` is called with a valid `name`, `description`, `paramSchema`, and non-empty `steps` array, THE `Skills_Tool` SHALL create a new `SkillRecord` with `version = 1` and return it.
2. WHEN `define_skill` is called with a `name` that already exists, THE `Skills_Tool` SHALL update the existing skill and set `version` to the previous version incremented by 1.
3. WHEN `define_skill` is called, THE `SkillsStore` SHALL set `updated_at` to the current timestamp on every upsert.
4. IF `define_skill` is called with a `name` that does not match the pattern `/^[a-z0-9]+(-[a-z0-9]+)*$/`, THEN THE `Skills_Tool` SHALL return `errorCode: INVALID_INPUT`.
5. IF `define_skill` is called with an empty `steps` array or more than 100 steps, THEN THE `Skills_Tool` SHALL return `errorCode: INVALID_INPUT`.
6. IF `define_skill` is called with a `description` exceeding 1000 characters, THEN THE `Skills_Tool` SHALL return `errorCode: INVALID_INPUT`.
7. IF a step has `type: 'prompt'` and no `template` field, THEN THE `Skills_Tool` SHALL return `errorCode: INVALID_INPUT` identifying the step index.
8. IF a step has `type: 'tool_call'` and no `tool` field, THEN THE `Skills_Tool` SHALL return `errorCode: INVALID_INPUT` identifying the step index.

---

### Requirement 3: Skill Execution (execute_skill)

**User Story:** As an LLM agent, I want to execute a skill by name with concrete parameter values, so that I receive a fully resolved step sequence ready to act on.

#### Acceptance Criteria

1. WHEN `execute_skill` is called with a valid `name` and all required params present, THE `Skills_Tool` SHALL return a `ResolvedStep` array whose length equals the number of steps in the skill.
2. WHEN `execute_skill` resolves a `prompt` step, THE `Skills_Tool` SHALL replace every `{{paramName}}` token whose key is present in `params` with `String(params[paramName])`.
3. WHEN `execute_skill` resolves a `tool_call` step, THE `Skills_Tool` SHALL replace every `{{paramName}}` token in each arg value whose key is present in `params` with `String(params[paramName])`.
4. WHEN `execute_skill` encounters a `{{placeholder}}` token whose key is not present in `params`, THE `Skills_Tool` SHALL leave that token unchanged in the resolved output.
5. THE `Skills_Tool` SHALL NOT mutate the original `steps` array stored in the database during resolution.
6. IF `execute_skill` is called with a `name` that does not exist, THEN THE `Skills_Tool` SHALL return `errorCode: NOT_FOUND`.
7. IF `execute_skill` is called without all keys listed in `paramSchema.required`, THEN THE `Skills_Tool` SHALL return `errorCode: INVALID_INPUT` listing the missing parameter names.

---

### Requirement 4: Skill Retrieval (get_skill)

**User Story:** As an LLM agent, I want to retrieve the full definition of a skill by name or ID, so that I can inspect its steps and parameter schema.

#### Acceptance Criteria

1. WHEN `get_skill` is called with a `name` that exists, THE `Skills_Tool` SHALL return the full `SkillRecord` for that skill.
2. WHEN `get_skill` is called with a UUID `id` that exists, THE `Skills_Tool` SHALL return the full `SkillRecord` for that skill.
3. IF `get_skill` is called with a `name` or `id` that does not exist, THEN THE `Skills_Tool` SHALL return `errorCode: NOT_FOUND`.

---

### Requirement 5: Skill Listing (list_skills)

**User Story:** As an LLM agent, I want to list all available skills with pagination, so that I can discover which playbooks are available without loading full definitions.

#### Acceptance Criteria

1. WHEN `list_skills` is called, THE `Skills_Tool` SHALL return an array of `SkillSummary` objects for all stored skills.
2. WHEN `list_skills` is called with a `limit` value, THE `Skills_Tool` SHALL return at most `limit` results.
3. WHEN `list_skills` is called with an `offset` value, THE `Skills_Tool` SHALL skip the first `offset` results.
4. WHEN `limit` is omitted, THE `Skills_Tool` SHALL default to returning at most 20 results.
5. WHEN `offset` is omitted, THE `Skills_Tool` SHALL default to an offset of 0.
6. THE `SkillSummary` SHALL include `id`, `name`, `description`, `stepCount`, `version`, and `updatedAt` fields.

---

### Requirement 6: Skill Deletion (delete_skill)

**User Story:** As an LLM agent, I want to delete a skill by name or ID, so that I can remove outdated or incorrect playbooks from the store.

#### Acceptance Criteria

1. WHEN `delete_skill` is called with a `name` that exists, THE `Skills_Tool` SHALL remove the skill from the store and return `{ deleted: true }`.
2. WHEN `delete_skill` is called with a UUID `id` that exists, THE `Skills_Tool` SHALL remove the skill from the store and return `{ deleted: true }`.
3. IF `delete_skill` is called with a `name` or `id` that does not exist, THEN THE `Skills_Tool` SHALL return `errorCode: NOT_FOUND`.

---

### Requirement 7: SQLite Persistence

**User Story:** As an LLM agent, I want skill definitions to survive process restarts, so that playbooks I define in one session are available in future sessions.

#### Acceptance Criteria

1. THE `SkillsStore` SHALL initialize the SQLite schema on construction, creating the `skills` table and `idx_skills_name` index if they do not exist.
2. THE `SkillsStore` SHALL open the database in WAL mode.
3. WHEN a skill is defined, THE `SkillsStore` SHALL serialize `paramSchema` and `steps` as JSON text columns.
4. WHEN a skill is retrieved, THE `SkillsStore` SHALL deserialize `param_schema_json` and `steps_json` back into their structured forms.
5. WHEN `SKILLS_DB_PATH` environment variable is set, THE `Skills_Tool` SHALL use that path as the SQLite database file location.
6. WHEN `SKILLS_DB_PATH` is not set, THE `Skills_Tool` SHALL default to `./skills.db`.

---

### Requirement 8: Input Validation

**User Story:** As a system operator, I want all inputs to be validated before reaching the database, so that malformed data is rejected with clear error messages.

#### Acceptance Criteria

1. THE `Policy` SHALL validate `define_skill` inputs and throw a `ValidationError` for any violation before any database operation.
2. THE `Policy` SHALL validate `execute_skill` inputs and throw a `ValidationError` for any violation before any database operation.
3. THE `Policy` SHALL validate `get_skill`, `list_skills`, and `delete_skill` inputs and throw a `ValidationError` for any violation before any database operation.
4. WHEN a `ValidationError` is thrown, THE `Skills_Tool` SHALL return `errorCode: INVALID_INPUT` with a descriptive message.
5. THE `Policy` SHALL enforce that `{{placeholder}}` names within step templates and arg values match the pattern `/^\w+$/`.

---

### Requirement 9: Error Handling

**User Story:** As an LLM agent, I want all error conditions to return structured responses rather than throwing, so that error handling is uniform and predictable.

#### Acceptance Criteria

1. THE `Skills_Tool` SHALL return a `ToolResponse` envelope in all code paths and SHALL NOT throw exceptions to callers.
2. WHEN a skill is not found by name or id, THE `Skills_Tool` SHALL return `errorCode: NOT_FOUND`.
3. WHEN input validation fails, THE `Skills_Tool` SHALL return `errorCode: INVALID_INPUT` with a message describing the violation.
4. WHEN an unexpected SQLite error occurs, THE `Skills_Tool` SHALL return `errorCode: EXECUTION_FAILED`.
5. WHEN an unexpected error occurs, THE `Skills_Tool` SHALL log the error to stderr and continue running.
6. WHEN an HTTP request results in `NOT_FOUND`, THE `HTTP_Server` SHALL return HTTP status 404.
7. WHEN an HTTP request results in `INVALID_INPUT`, THE `HTTP_Server` SHALL return HTTP status 400.
8. WHEN an HTTP request results in `EXECUTION_FAILED`, THE `HTTP_Server` SHALL return HTTP status 500.

---

### Requirement 10: MCP Flat Input Shape

**User Story:** As an LLM agent using the MCP interface, I want a single flat tool schema for all skill actions, so that I can discover and invoke any operation without navigating discriminated unions.

#### Acceptance Criteria

1. THE `MCP_Server` SHALL expose a single `skills` tool with a flat Zod input shape where `action` is the only required field.
2. THE `MCP_Server` SHALL accept `action` values: `define_skill`, `execute_skill`, `get_skill`, `list_skills`, `delete_skill`.
3. THE `MCP_Server` SHALL expose all action-specific fields (`name`, `description`, `paramSchema`, `steps`, `params`, `id`, `limit`, `offset`) as optional fields on the flat shape.
4. WHEN the `MCP_Server` receives a tool call, THE `MCP_Server` SHALL route to the appropriate core function based on the `action` field.
5. WHEN a core function returns an error, THE `MCP_Server` SHALL set `isError: true` on the `CallToolResult`.
