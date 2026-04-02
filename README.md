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

### New web app + API

```bash
cp .env.example .env
# Python API
pip install -r requirements-api.txt
uvicorn backend.main:app --reload --port 8000

# Next.js frontend
cd web
npm install
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 npm run dev
```

### Legacy Streamlit app

```bash
pip install -r requirements-phase1.txt
streamlit run app.py
```

## Deployment

### Web + API

- Deploy `web/` to Vercel
- Deploy `backend/` to a Python host such as Render / Railway / Fly
- Set `NEXT_PUBLIC_API_BASE_URL` in the frontend host

### Legacy Streamlit deployment

Point Streamlit Community Cloud to **`requirements-phase1.txt`**, not `requirements.txt`.

In app settings: **Advanced settings → Python packages file → `requirements-phase1.txt`**

| File | Purpose |
|---|---|
| `requirements-phase1.txt` | Phase 1 deps — use for Streamlit Cloud deployment |
| `requirements-phase3.txt` | Heavy NLP deps (transformers, bertopic, spacy) — Phase 3 local only |
| `requirements.txt` | Full list (all 3 phases) — local development only |

## Data Storage

Processed Parquet files live in **Supabase Storage** (bucket: `veeduria-processed`), not
in the git repo. GitHub tracks only: code, metadata JSONs, model validation results, and
reference data < 1MB.

## Documentation

See [CLAUDE.md](CLAUDE.md) for full architecture, data sources, ML standards, and dev commands.
