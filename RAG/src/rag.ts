import crypto from "crypto";
import {
  ErrorCode,
  type ToolResponse,
  createErrorResponse,
  createSuccessResponse,
} from "@shared/types";
import { chunkTextByTokens } from "./chunker";
import { type EmbeddingProvider, createEmbeddingProvider } from "./embeddings";
import {
  normalizeChunkSize,
  normalizeOverlap,
  normalizeTopK,
  validateDeleteInput,
  validateIngestInput,
  validateListInput,
  validateQueryInput,
  validateReindexInput,
} from "./policy";
import { rankChunks } from "./retrieval";
import { RAGStore } from "./store";
import type {
  DeleteSourceInput,
  DocumentInput,
  IngestDocumentsInput,
  ListSourcesInput,
  QueryKnowledgeInput,
  RagRequest,
  ReindexSourceInput,
  SourceType,
} from "./types";

const DB_PATH = process.env.RAG_DB_PATH ?? "./rag.db";
const DOC_SCRAPER_ENDPOINT =
  process.env.RAG_DOC_SCRAPER_ENDPOINT ?? "http://localhost:3336/tools/read_document";
const ASK_USER_ENDPOINT =
  process.env.RAG_ASK_USER_ENDPOINT ?? "http://localhost:3338/tools/ask_user_interview";

type ApprovalResponse = {
  questionId?: string;
  value?: unknown;
};

type AskUserResponse = {
  interviewId?: string;
  status?: string;
  responses?: ApprovalResponse[];
  data?: {
    interviewId?: string;
    status?: string;
    responses?: ApprovalResponse[];
  };
};

type ScraperResponse = {
  success?: boolean;
  error?: string;
  errorMessage?: string;
  title?: string;
  content?: string;
  data?: {
    title?: string;
    content?: string;
    data?: {
      content?: string;
    };
  };
};

function hashText(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function inferSourceType(document: DocumentInput): SourceType {
  if (document.url) {
    return "url";
  }
  if (document.filePath) {
    return "file";
  }
  return "text";
}

function inferSourceKey(document: DocumentInput): string {
  return (
    document.sourceKey ||
    document.filePath ||
    document.url ||
    `text:${hashText(document.text || "")}`
  );
}

function pickDocumentText(resultBody: ScraperResponse | undefined): string | undefined {
  if (!resultBody) {
    return undefined;
  }

  const direct = resultBody.content;
  if (typeof direct === "string" && direct.trim()) {
    return direct;
  }

  const nested = resultBody.data?.content;
  if (typeof nested === "string" && nested.trim()) {
    return nested;
  }

  const nested2 = resultBody.data?.data?.content;
  if (typeof nested2 === "string" && nested2.trim()) {
    return nested2;
  }

  return undefined;
}

function buildApprovalQuestion(action: string, details: string): string {
  return `Approve '${action}' in RAG knowledge base? ${details}`;
}

class RAGService {
  private readonly store: RAGStore;
  private readonly embeddings: EmbeddingProvider;

  constructor() {
    this.store = new RAGStore(DB_PATH);
    this.embeddings = createEmbeddingProvider();
  }

  private async requestApproval(action: string, details: string): Promise<ToolResponse> {
    const response = await fetch(ASK_USER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        payload: {
          title: `Approve ${action}`,
          expiresInSeconds: 1800,
          questions: [
            {
              id: "approve",
              type: "confirm",
              required: true,
              prompt: buildApprovalQuestion(action, details),
            },
          ],
        },
      }),
    });

    if (!response.ok) {
      return createErrorResponse(
        ErrorCode.EXECUTION_FAILED,
        "Unable to create approval interview via AskUser.",
      );
    }

    const body = (await response.json()) as AskUserResponse;

    return createSuccessResponse({
      status: "approval_required",
      action,
      interviewId: body?.interviewId || body?.data?.interviewId,
      message: "Approval is required. Submit approvalInterviewId after answering in AskUser.",
    });
  }

  private async ensureApproved(
    action: string,
    details: string,
    approvalInterviewId?: string,
  ): Promise<{ ok: true } | { ok: false; response: ToolResponse }> {
    if (!approvalInterviewId) {
      return {
        ok: false,
        response: await this.requestApproval(action, details),
      };
    }

    const response = await fetch(ASK_USER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "get",
        payload: {
          interviewId: approvalInterviewId,
        },
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        response: createErrorResponse(
          ErrorCode.EXECUTION_FAILED,
          "Unable to verify approval interview via AskUser.",
        ),
      };
    }

    const body = (await response.json()) as AskUserResponse;
    const status = body?.status || body?.data?.status;
    const responses = body?.responses || body?.data?.responses || [];
    const approval = Array.isArray(responses)
      ? responses.find((item) => item?.questionId === "approve")
      : undefined;

    if (status === "answered" && approval?.value === true) {
      return { ok: true };
    }

    if (status === "pending") {
      return {
        ok: false,
        response: createSuccessResponse({
          status: "approval_pending",
          action,
          interviewId: approvalInterviewId,
          message: "Approval interview has not been answered yet.",
        }),
      };
    }

    return {
      ok: false,
      response: createErrorResponse(
        ErrorCode.POLICY_BLOCKED,
        "Write operation requires explicit approval and was not approved.",
      ),
    };
  }

  private async resolveText(document: DocumentInput): Promise<{ content: string; title?: string }> {
    if (document.text?.trim()) {
      return { content: document.text.trim(), title: document.title };
    }

    const body: Record<string, unknown> = {};
    if (document.filePath) {
      body.filePath = document.filePath;
    }
    if (document.url) {
      body.url = document.url;
    }

    const response = await fetch(DOC_SCRAPER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const payload = (await response.json()) as ScraperResponse;
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || payload?.errorMessage || "Document scraping failed.");
    }

    const content = pickDocumentText(payload);
    if (!content) {
      throw new Error("Unable to extract document content.");
    }

    const title = payload?.title || payload?.data?.title || document.title;
    return { content, title };
  }

  async ingestDocuments(input: IngestDocumentsInput): Promise<ToolResponse> {
    const validationError = validateIngestInput(input);
    if (validationError) {
      return createErrorResponse(ErrorCode.INVALID_INPUT, validationError);
    }

    const approval = await this.ensureApproved(
      "ingest_documents",
      `${input.documents.length} document(s) will be added or updated in persistent knowledge storage.`,
      input.approvalInterviewId,
    );

    if (!approval.ok) {
      return approval.response;
    }

    const chunkSize = normalizeChunkSize(input.chunkSizeTokens);
    const overlap = normalizeOverlap(input.overlapTokens, chunkSize);

    const results: Array<Record<string, unknown>> = [];

    for (const document of input.documents) {
      const resolved = await this.resolveText(document);
      const sourceKey = inferSourceKey(document);
      const sourceType = inferSourceType(document);
      const chunks = await chunkTextByTokens(resolved.content, this.embeddings, chunkSize, overlap);
      const embeddings = await this.embeddings.embedBatch(chunks.map((chunk) => chunk.content));

      const source = this.store.upsertSource({
        sourceKey,
        sourceType,
        title: resolved.title || document.title,
        metadata: document.metadata,
        fullText: resolved.content,
      });

      this.store.replaceChunks(
        source.id,
        chunks.map((chunk, index) => ({
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          embedding: embeddings[index],
          metadata: {
            sourceKey,
            sourceType,
          },
        })),
      );

      results.push({
        sourceId: source.id,
        sourceKey,
        sourceType,
        chunkCount: chunks.length,
        tokenCount: chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0),
      });
    }

    return createSuccessResponse({
      status: "ingested",
      processed: results.length,
      results,
      chunkSizeTokens: chunkSize,
      overlapTokens: overlap,
    });
  }

  async queryKnowledge(input: QueryKnowledgeInput): Promise<ToolResponse> {
    const validationError = validateQueryInput(input);
    if (validationError) {
      return createErrorResponse(ErrorCode.INVALID_INPUT, validationError);
    }

    const topK = normalizeTopK(input.topK);
    const queryVector = (await this.embeddings.embedBatch([input.query]))[0];

    const chunks = this.store.getAllChunks({
      sourceIds: input.sourceIds,
      sourceKeys: input.sourceKeys,
    });

    const results = rankChunks({
      queryEmbedding: queryVector,
      chunks,
      sourcesById: this.store.getSourceMap(),
      topK,
      minScore: input.minScore,
    });

    return createSuccessResponse({
      query: input.query,
      topK,
      results,
    });
  }

  async listSources(input: ListSourcesInput): Promise<ToolResponse> {
    const validationError = validateListInput(input);
    if (validationError) {
      return createErrorResponse(ErrorCode.INVALID_INPUT, validationError);
    }

    const limit = input.limit ? Math.min(Math.floor(input.limit), 200) : 50;
    const offset = input.offset ? Math.max(Math.floor(input.offset), 0) : 0;
    const sources = this.store.listSources(limit, offset);

    return createSuccessResponse({
      totalReturned: sources.length,
      limit,
      offset,
      sources,
    });
  }

  async deleteSource(input: DeleteSourceInput): Promise<ToolResponse> {
    const validationError = validateDeleteInput(input);
    if (validationError) {
      return createErrorResponse(ErrorCode.INVALID_INPUT, validationError);
    }

    const source = this.store.getSourceById(input.sourceId);
    if (!source) {
      return createErrorResponse(ErrorCode.NOT_FOUND, "Source not found.");
    }

    const approval = await this.ensureApproved(
      "delete_source",
      `Source '${source.source_key}' with ${source.chunk_count} chunk(s) will be removed.`,
      input.approvalInterviewId,
    );

    if (!approval.ok) {
      return approval.response;
    }

    const result = this.store.deleteSource(input.sourceId);

    return createSuccessResponse({
      status: "deleted",
      sourceId: input.sourceId,
      sourceDeleted: result.sourceDeleted,
      chunksDeleted: result.chunksDeleted,
    });
  }

  async reindexSource(input: ReindexSourceInput): Promise<ToolResponse> {
    const validationError = validateReindexInput(input);
    if (validationError) {
      return createErrorResponse(ErrorCode.INVALID_INPUT, validationError);
    }

    const source = this.store.getSourceById(input.sourceId);
    if (!source) {
      return createErrorResponse(ErrorCode.NOT_FOUND, "Source not found.");
    }

    const approval = await this.ensureApproved(
      "reindex_source",
      `Source '${source.source_key}' will be re-chunked and re-embedded.`,
      input.approvalInterviewId,
    );

    if (!approval.ok) {
      return approval.response;
    }

    const sourceText = source.source_text as string;
    if (!sourceText || !sourceText.trim()) {
      return createErrorResponse(
        ErrorCode.EXECUTION_FAILED,
        "Source content is unavailable for reindex.",
      );
    }

    const chunkSize = normalizeChunkSize(input.chunkSizeTokens);
    const overlap = normalizeOverlap(input.overlapTokens, chunkSize);
    const chunks = await chunkTextByTokens(sourceText, this.embeddings, chunkSize, overlap);
    const vectors = await this.embeddings.embedBatch(chunks.map((chunk) => chunk.content));

    this.store.replaceChunks(
      source.id,
      chunks.map((chunk, index) => ({
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        embedding: vectors[index],
        metadata: {
          sourceKey: source.source_key,
          reindexedAt: new Date().toISOString(),
        },
      })),
    );

    return createSuccessResponse({
      status: "reindexed",
      sourceId: source.id,
      sourceKey: source.source_key,
      chunkCount: chunks.length,
      chunkSizeTokens: chunkSize,
      overlapTokens: overlap,
    });
  }
}

const service = new RAGService();

export async function handleRAGRequest(request: RagRequest): Promise<ToolResponse> {
  if (!request || !request.action || !request.payload) {
    return createErrorResponse(
      ErrorCode.INVALID_INPUT,
      "Request must contain 'action' and 'payload'.",
    );
  }

  try {
    if (request.action === "ingest_documents") {
      return await service.ingestDocuments(request.payload as IngestDocumentsInput);
    }

    if (request.action === "query_knowledge") {
      return await service.queryKnowledge(request.payload as QueryKnowledgeInput);
    }

    if (request.action === "list_sources") {
      return await service.listSources(request.payload as ListSourcesInput);
    }

    if (request.action === "delete_source") {
      return await service.deleteSource(request.payload as DeleteSourceInput);
    }

    if (request.action === "reindex_source") {
      return await service.reindexSource(request.payload as ReindexSourceInput);
    }

    return createErrorResponse(ErrorCode.INVALID_INPUT, `Unsupported action '${request.action}'.`);
  } catch (error) {
    return createErrorResponse(
      ErrorCode.EXECUTION_FAILED,
      error instanceof Error ? error.message : String(error),
    );
  }
}
