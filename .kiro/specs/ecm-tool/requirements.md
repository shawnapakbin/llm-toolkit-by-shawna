# Requirements Document

## Introduction

The Extended Context Memory (ECM) Tool is an external sliding-window context manager that enables an effective 1 million token context window for LLM agents without exceeding hardware limits. It persists conversation turns, tool outputs, documents, and reasoning traces as retrievable segments with vector embeddings in a SQLite database, then assembles a focused, relevance-ranked context window on demand. The tool exposes a single MCP tool (`ecm`) and an HTTP Express server on port 3342, following the established monorepo pattern in the `ECM/` workspace.

## Glossary

- **ECM_Tool**: The Extended Context Memory tool — the system under specification
- **ECMStore**: The SQLite persistence layer managing the `ecm_segments` table
- **EmbeddingProvider**: The component that calls LM Studio (or mock) to produce vector embeddings
- **Segment**: A single stored unit of memory — a row in `ecm_segments` with content, embedding, type, and metadata
- **SegmentRecord**: The TypeScript interface representing a persisted segment as returned by the API
- **Session**: A named namespace (identified by `sessionId`) that isolates segments per agent session
- **CompositeScore**: The retrieval ranking score: `(cosine * 0.7) + (importance * 0.2) + (recency * 0.1)`
- **RecencyScore**: `1 / (1 + ageInHours)` — a value in `(0, 1]` that decreases as a segment ages
- **TokenCount**: The estimated token count for a content string: `Math.ceil(content.length / 4)`
- **TokenBudget**: The `maxTokens` cap on the total token count of segments returned by `retrieve_context`
- **ExtractSummarizer**: The purely extractive (no LLM) sentence-scoring algorithm used by `summarize_session`
- **MCP_Server**: The Model Context Protocol server that exposes the `ecm` tool over stdio
- **HTTP_Server**: The Express HTTP server on port 3342 that mirrors MCP operations over REST
- **Policy**: The pure input validation layer (`policy.ts`) with no I/O side effects
- **SegmentType**: One of `conversation_turn`, `tool_output`, `document`, `reasoning`, `summary`

## Requirements

### Requirement 1: Store Segments

**User Story:** As an LLM agent, I want to store memory segments with content and metadata, so that I can persist conversation turns, tool outputs, documents, and reasoning traces for later retrieval.

#### Acceptance Criteria

1. WHEN a `store_segment` action is received with valid `sessionId`, `type`, and `content`, THE ECM_Tool SHALL insert a new segment into the ECMStore and return a `SegmentRecord` with a UUID `id`, the provided `sessionId`, `type`, and `content`, and a `tokenCount` equal to `Math.ceil(content.length / 4)`.
2. WHEN a `store_segment` action is received without `sessionId`, `type`, or `content`, THE Policy SHALL reject the input and THE ECM_Tool SHALL return a `ToolResponse` with `errorCode: INVALID_INPUT`.
3. WHEN a `store_segment` action is received with `importance` not provided, THE ECM_Tool SHALL default `importance` to `0.5`.
4. WHEN a `store_segment` action is received with `importance` outside the range `[0, 1]`, THE Policy SHALL reject the input and THE ECM_Tool SHALL return a `ToolResponse` with `errorCode: INVALID_INPUT`.
5. WHEN a `store_segment` action is received with a valid `type` value from `['conversation_turn', 'tool_output', 'document', 'reasoning', 'summary']`, THE ECM_Tool SHALL accept the segment and persist it with that type.
6. WHEN a `store_segment` action is received with an invalid `type` value, THE Policy SHALL reject the input and THE ECM_Tool SHALL return a `ToolResponse` with `errorCode: INVALID_INPUT`.
7. WHEN the EmbeddingProvider fails during `store_segment`, THE ECM_Tool SHALL return a `ToolResponse` with `errorCode: EXECUTION_FAILED` and SHALL NOT write any partial segment to the ECMStore.

### Requirement 2: Retrieve Context

**User Story:** As an LLM agent, I want to retrieve the most relevant memory segments for a given query within a token budget, so that I can assemble a focused context window before each reasoning turn.

#### Acceptance Criteria

1. WHEN a `retrieve_context` action is received with valid `sessionId` and `query`, THE ECM_Tool SHALL embed the query, score all segments in the session using the CompositeScore formula, and return segments sorted by score descending.
2. WHILE assembling the result for `retrieve_context`, THE ECM_Tool SHALL enforce the TokenBudget such that `result.totalTokens <= input.maxTokens` for all returned segment sets.
3. WHEN the TokenBudget causes one or more scored segments to be excluded from the result, THE ECM_Tool SHALL set `result.truncated` to `true`.
4. WHEN all scored segments fit within the TokenBudget, THE ECM_Tool SHALL set `result.truncated` to `false`.
5. WHEN `maxTokens` is not provided, THE ECM_Tool SHALL default it to `4096`.
6. WHEN `topK` is not provided, THE ECM_Tool SHALL default it to `10`.
7. WHEN `minScore` is provided, THE ECM_Tool SHALL exclude all segments with a CompositeScore below `minScore` from the result.
8. WHEN `retrieve_context` is called for a `sessionId` with no stored segments, THE ECM_Tool SHALL return `{ segments: [], totalTokens: 0, truncated: false }` without error.
9. WHEN `maxTokens` is smaller than the `tokenCount` of every scored segment, THE ECM_Tool SHALL return `{ segments: [], totalTokens: 0, truncated: true }` without error.
10. THE ECM_Tool SHALL only return segments whose `sessionId` matches the `sessionId` in the `retrieve_context` input.

### Requirement 3: List Segments

**User Story:** As an LLM agent, I want to list stored segments for a session with pagination, so that I can inspect the contents of a session's memory store.

#### Acceptance Criteria

1. WHEN a `list_segments` action is received with a valid `sessionId`, THE ECM_Tool SHALL return a paginated list of `SegmentRecord` objects for that session and a `total` count of all segments in the session.
2. WHEN `limit` is not provided, THE ECM_Tool SHALL default it to `20`.
3. WHEN `offset` is not provided, THE ECM_Tool SHALL default it to `0`.
4. WHEN `list_segments` is called for a `sessionId` with no stored segments, THE ECM_Tool SHALL return `{ segments: [], total: 0 }` without error.
5. THE ECM_Tool SHALL only return segments whose `sessionId` matches the `sessionId` in the `list_segments` input.

### Requirement 4: Delete Segment

**User Story:** As an LLM agent, I want to delete a specific segment by ID, so that I can remove stale or incorrect memory entries.

#### Acceptance Criteria

1. WHEN a `delete_segment` action is received with a valid `segmentId` that exists in the ECMStore, THE ECM_Tool SHALL remove the segment and return `{ deleted: true }`.
2. WHEN a `delete_segment` action is received with a `segmentId` that does not exist in the ECMStore, THE ECM_Tool SHALL return a `ToolResponse` with `errorCode: NOT_FOUND`.
3. WHEN a `delete_segment` action is received without a `segmentId`, THE Policy SHALL reject the input and THE ECM_Tool SHALL return a `ToolResponse` with `errorCode: INVALID_INPUT`.

### Requirement 5: Clear Session

**User Story:** As an LLM agent, I want to clear all segments for a session, so that I can reset the memory store when starting a new task or when a session is no longer needed.

#### Acceptance Criteria

1. WHEN a `clear_session` action is received with a valid `sessionId`, THE ECM_Tool SHALL delete all segments for that session from the ECMStore and return the count of deleted segments.
2. WHEN a `clear_session` action is received for a `sessionId` with no segments, THE ECM_Tool SHALL return `{ deletedCount: 0 }` without error.
3. WHEN a `clear_session` action is received for `sessionId_A`, THE ECMStore SHALL NOT delete or modify any segments belonging to any other session.

### Requirement 6: Summarize Session

**User Story:** As an LLM agent, I want to compress old segments into a summary, so that I can reduce memory store size while preserving the gist of older context.

#### Acceptance Criteria

1. WHEN a `summarize_session` action is received with a valid `sessionId` and at least 2 non-summary segments outside the `keepNewest` boundary, THE ECM_Tool SHALL insert exactly one new segment of type `summary` for the session.
2. WHEN a `summarize_session` action completes successfully, THE ECMStore SHALL no longer contain the original non-summary segments that were summarized.
3. WHEN a `summarize_session` action is received with `keepNewest` specified, THE ECM_Tool SHALL leave the `keepNewest` newest non-summary segments untouched in the ECMStore.
4. WHEN `keepNewest` is not provided, THE ECM_Tool SHALL default it to `10`.
5. WHEN a `summarize_session` action is received and fewer than 2 non-summary segments exist outside the `keepNewest` boundary, THE ECM_Tool SHALL return a `ToolResponse` with `errorCode: INVALID_INPUT` and SHALL NOT modify the ECMStore.
6. THE ECM_Tool SHALL set the `importance` of the inserted summary segment to `0.8`.
7. THE ECM_Tool SHALL compute the summary using the ExtractSummarizer (no LLM call) and set the summary segment's `tokenCount` to `Math.ceil(summaryText.length / 4)`.
8. WHEN a `summarize_session` action encounters a storage failure, THE ECMStore SHALL roll back all changes atomically so that no partial state is written.

### Requirement 7: Composite Score Computation

**User Story:** As an LLM agent, I want segments ranked by a composite score that balances semantic relevance, importance, and recency, so that the most useful segments are returned first.

#### Acceptance Criteria

1. THE ECM_Tool SHALL compute the CompositeScore as `(cosineSimilarity * 0.7) + (importance * 0.2) + (recencyScore * 0.1)` for each candidate segment during `retrieve_context`.
2. THE ECM_Tool SHALL compute `recencyScore` as `1 / (1 + ageInHours)` where `ageInHours` is the elapsed time in hours since the segment's `createdAt` timestamp.
3. FOR ALL pairs of segments where segment A is older than segment B, THE ECM_Tool SHALL assign a lower `recencyScore` to segment A than to segment B.
4. THE ECM_Tool SHALL produce a CompositeScore in the range `[-0.7, 1.0]` for any valid segment and query embedding pair.

### Requirement 8: Extractive Summarization

**User Story:** As an LLM agent, I want session summarization to work without an LLM call, so that the tool remains fast and self-contained.

#### Acceptance Criteria

1. THE ExtractSummarizer SHALL produce a non-empty output string for any non-empty array of segments with non-empty content.
2. THE ExtractSummarizer SHALL produce output whose character length is at most `Math.min(segments.length * 200, 2000)`.
3. THE ExtractSummarizer SHALL score sentences using position, length, and segment importance heuristics without making any external API calls.
4. THE ExtractSummarizer SHALL re-order selected sentences by their original position in the source text before joining them.

### Requirement 9: Token Count Estimation

**User Story:** As an LLM agent, I want a consistent token count estimate for all stored segments, so that the token budget enforcement is predictable and reliable.

#### Acceptance Criteria

1. THE ECM_Tool SHALL compute `tokenCount` as `Math.ceil(content.length / 4)` for every segment at store time.
2. FOR ALL non-empty content strings, THE ECM_Tool SHALL produce a `tokenCount` of at least `1`.
3. THE ECM_Tool SHALL use the stored `tokenCount` value (not recompute it) when enforcing the TokenBudget during `retrieve_context`.

### Requirement 10: Input Validation

**User Story:** As an LLM agent, I want all invalid inputs to be rejected with clear error codes, so that I can detect and correct mistakes in my tool calls.

#### Acceptance Criteria

1. THE Policy SHALL validate all inputs before any I/O operation is performed.
2. WHEN any required field is missing from an action input, THE Policy SHALL return a validation error and THE ECM_Tool SHALL return a `ToolResponse` with `errorCode: INVALID_INPUT`.
3. WHEN any field value violates its type or range constraint, THE Policy SHALL return a validation error and THE ECM_Tool SHALL return a `ToolResponse` with `errorCode: INVALID_INPUT`.
4. THE Policy SHALL perform validation without making any I/O calls (pure function).

### Requirement 11: HTTP Server

**User Story:** As an LLM agent or developer, I want to call ECM operations over HTTP, so that I can integrate the tool without requiring stdio MCP transport.

#### Acceptance Criteria

1. THE HTTP_Server SHALL listen on port `3342` (configurable via the `PORT` environment variable).
2. WHEN `GET /health` is called, THE HTTP_Server SHALL return HTTP 200 with a health status response.
3. WHEN `GET /tool-schema` is called, THE HTTP_Server SHALL return the MCP tool schema for the `ecm` tool.
4. WHEN `POST /tools/ecm` is called with a valid action payload, THE HTTP_Server SHALL route the request to the corresponding ECM_Tool handler and return the result.
5. WHEN `POST /tools/ecm` is called with an invalid payload, THE HTTP_Server SHALL return HTTP 400.
6. THE HTTP_Server SHALL support CORS.

### Requirement 12: MCP Server

**User Story:** As an LLM agent using stdio MCP transport, I want to call ECM operations via the `ecm` MCP tool, so that I can use the tool within a standard MCP-compatible agent framework.

#### Acceptance Criteria

1. THE MCP_Server SHALL register a single tool named `ecm` with a flat Zod input shape where `action` is the only required field.
2. WHEN a valid `ecm` tool call is received, THE MCP_Server SHALL route to the correct ECM_Tool handler based on the `action` field and return a `CallToolResult`.
3. WHEN an invalid `ecm` tool call is received, THE MCP_Server SHALL return a `CallToolResult` with `isError: true`.
4. THE MCP_Server SHALL support all six actions: `store_segment`, `retrieve_context`, `list_segments`, `delete_segment`, `clear_session`, and `summarize_session`.

### Requirement 13: Session Isolation

**User Story:** As an LLM agent running multiple concurrent sessions, I want each session's memory to be fully isolated, so that segments from one session never contaminate another session's context.

#### Acceptance Criteria

1. THE ECM_Tool SHALL never return segments from session B in response to any action targeting session A, where session A and session B have different `sessionId` values.
2. WHEN `clear_session` is called for session A, THE ECMStore SHALL retain all segments belonging to sessions with different `sessionId` values.
3. THE ECMStore SHALL enforce session isolation at the query level by filtering all reads by `sessionId`.

### Requirement 14: Persistence and Storage

**User Story:** As an LLM agent, I want segments to be durably persisted in SQLite, so that memory survives server restarts and is reliably stored.

#### Acceptance Criteria

1. THE ECMStore SHALL initialize the `ecm_segments` table and all required indexes on construction if they do not already exist.
2. THE ECMStore SHALL operate SQLite in WAL mode to support concurrent reads.
3. THE ECMStore SHALL store `embedding` as a JSON-serialized `TEXT` column (`embedding_json`) and `metadata` as a JSON-serialized `TEXT` column (`metadata_json`).
4. THE ECMStore SHALL use the database file path specified by the `ECM_DB_PATH` environment variable, defaulting to a path relative to `__dirname`.
5. WHEN a SQLite error occurs during any operation, THE ECM_Tool SHALL return a `ToolResponse` with `errorCode: EXECUTION_FAILED` and the HTTP_Server SHALL remain running.

### Requirement 15: Embedding Integration

**User Story:** As an LLM agent, I want segments to be embedded using the configured LM Studio model, so that semantic similarity search works correctly during retrieval.

#### Acceptance Criteria

1. THE EmbeddingProvider SHALL call the LM Studio embedding endpoint using the model specified by the `ECM_EMBEDDING_MODEL` environment variable (default: `nomic-ai/nomic-embed-text-v1.5`).
2. WHEN `ECM_EMBEDDINGS_MODE` is set to `mock`, THE EmbeddingProvider SHALL return deterministic mock embeddings without calling LM Studio.
3. WHEN the EmbeddingProvider is called with a batch of texts, THE EmbeddingProvider SHALL return one embedding vector per input text.
4. WHEN the LM Studio embedding endpoint is unavailable, THE EmbeddingProvider SHALL propagate the error so that THE ECM_Tool can return `errorCode: EXECUTION_FAILED`.
