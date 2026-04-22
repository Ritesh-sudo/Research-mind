# ResearchMind AI

Production-grade AI research platform with RAG, multi-provider AI, live LaTeX editor, and PDF compilation.

## Stack
- **Next.js 16** (App Router, Turbopack), TypeScript, Tailwind CSS
- **RAG**: pgvector + nomic-embed-text (Ollama) or text-embedding-3-small (OpenAI)
- **AI**: Ollama/Qwen (dev), Claude/Gemini/Groq (prod) — swappable via env var
- **DB**: PostgreSQL + pgvector via Prisma 7 + PrismaPg adapter
- **Editor**: Monaco Editor + server-side pdflatex
- **State**: Zustand, **Jobs**: Redis + BullMQ
- **Auth**: NextAuth.js (Google + GitHub)

## Quick Start (Local Dev)

### 1. Prerequisites
```bash
# Start PostgreSQL with pgvector
docker run -d --name pgvector -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 pgvector/pgvector:pg16

# Start Redis
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Install and start Ollama
brew install ollama && ollama serve

# Pull models
ollama pull qwen2.5:14b      # AI model (use qwen2.5:7b for 8GB RAM)
ollama pull nomic-embed-text  # Embedding model for RAG
```

### 2. Database Setup
```bash
# Create database and enable pgvector
psql -U postgres -h localhost -c "CREATE DATABASE researchmind;"
psql -U postgres -h localhost -d researchmind -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run migration
psql -U postgres -h localhost -d researchmind < prisma/migrations/0001_init/migration.sql
```

### 3. Environment
```bash
cp .env .env.local
# Edit .env.local — set NEXTAUTH_SECRET to a random 32-char string
# Set GOOGLE_CLIENT_ID/SECRET and/or GITHUB_CLIENT_ID/SECRET for auth
```

### 4. Run
```bash
npm install
npx prisma generate
npm run dev
# http://localhost:3000
```

## Docker Compose (Full Stack)
```bash
docker-compose up -d
# Ollama runs on host — app connects via OLLAMA_BASE_URL
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_PROVIDER` | `ollama` | `ollama`, `claude`, `openai`, `groq`, `gemini` |
| `AI_MODEL` | `qwen2.5:14b` | Model name for selected provider |
| `EMBEDDING_PROVIDER` | `ollama` | `ollama` or `openai` |
| `EMBEDDING_MODEL` | `nomic-embed-text` | Embedding model |
| `EMBEDDING_DIM` | `768` | Must match model output dimension |
| `DATABASE_URL` | `postgresql://...` | PostgreSQL with pgvector |
| `REDIS_URL` | `redis://localhost:6379` | For BullMQ background jobs |
| `ANTHROPIC_API_KEY` | — | For Claude in production |
| `NEXTAUTH_SECRET` | — | Random 32-char string (required) |

## RAG Architecture

Every AI call retrieves semantically relevant chunks before querying the model:

```
User query → embed → cosine search pgvector → top-8 chunks → inject into prompt → AI → ingest response back
```

Sources: uploaded PDFs, chat history, LaTeX sections, citations, hypotheses, arXiv abstracts.

## Features

- **AI Research Chat** — streaming, RAG-augmented, source citations, write-to-paper
- **LaTeX Editor** — Monaco + templates (NeurIPS/ICML/IEEE/ACM/arXiv) + live compile
- **PDF Preview** — live iframe, auto-compiles on Cmd+S
- **Knowledge Graph** — React Flow, RAG dedup on node creation
- **Hypothesis Tracker** — evidence scoring via BullMQ + pgvector
- **arXiv Feed** — semantic similarity filtering, near-duplicate alerts
- **Citation Manager** — Semantic Scholar search, DOI/arXiv lookup, BibTeX export
- **Corpus Analysis** — up to 20 PDFs, cross-paper RAG Q&A
- **Contradiction Detector** — background scan via BullMQ
- **Argument Validator** — RAG evidence checking per section
- **Figure Generator** — NL to matplotlib + pgfplots LaTeX
- **Novelty Score** — Semantic Scholar ANN search
