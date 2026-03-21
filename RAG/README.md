# LM Studio Tools - RAG

RAG MCP tool for persistent document ingestion and semantic retrieval.

## MCP Operations
- ingest_documents
- query_knowledge
- list_sources
- delete_source
- reindex_source

## Features
- Token-aware chunking
- LM Studio embeddings support
- SQLite source/chunk/vector persistence
- AskUser approval gating for write and destructive operations

## Environment Variables
- RAG_DB_PATH (default ./rag.db)
- RAG_EMBEDDING_MODEL (default nomic-ai/nomic-embed-text-v1.5)
- RAG_EMBEDDINGS_MODE (lmstudio|mock, default lmstudio)
- RAG_CHUNK_SIZE_TOKENS (default 350)
- RAG_CHUNK_OVERLAP_TOKENS (default 40)
- RAG_QUERY_TOP_K (default 6)
- RAG_DOC_SCRAPER_ENDPOINT (default http://localhost:3336/tools/read_document)
- RAG_ASK_USER_ENDPOINT (default http://localhost:3338/tools/ask_user_interview)
