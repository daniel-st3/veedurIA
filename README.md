# VeedurIA — Plataforma de Transparencia Cívica con IA

> Colombia's first AI-powered live public procurement and electoral accountability platform.

## Overview

VeedurIA now runs as a split stack:

- `web/` — Next.js product shell for landing, ContratoLimpio, and future phases
- `backend/` — FastAPI backend that exposes scored-contract endpoints for the web client
- `src/` — Python ingestion, feature engineering, model training, and shared data services

This keeps the ML and data pipeline in Python while moving the user-facing product to a
real web frontend that can scale across all three phases.

**Phase 1 — ContratoLimpio** · **Phase 2 — SigueElDinero** · **Phase 3 — PromesóMetro**

## Quick Start

```bash
cp .env.example .env
# Python API
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000

# Next.js frontend
cd web
npm install
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 npm run dev
```

## Deployment

- Deploy `web/` to Vercel
- Deploy `backend/` to a Python host such as Render / Railway / Fly
- Set `NEXT_PUBLIC_API_BASE_URL` in the frontend host

| File | Purpose |
|---|---|
| `requirements.txt` | Backend + pipeline dependencies for the active product |
| `requirements-api.txt` | Minimal backend runtime set |
| `requirements-phase3.txt` | Extra NLP dependencies for PromesMetro ingestion / scoring |

## Data Storage

Processed Parquet files live in **Supabase Storage** (bucket: `veeduria-processed`) and
may also exist locally during development. GitHub tracks only code, metadata JSONs,
model validation results, and light reference data.

## Documentation

See [CLAUDE.md](CLAUDE.md) for full architecture, data sources, ML standards, and dev commands.
