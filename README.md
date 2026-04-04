# VeedurIA

**VeedurIA** is a civic intelligence product for reading public power in Colombia.

It turns overwhelming public data into a product people can actually use:
- **ContratoLimpio** surfaces public contracts that break the expected pattern
- **Promesómetro** compares political promises against visible public action
- **SigueElDinero** is the next layer for tracing networks, money, and influence

This is not a dashboard made to impress other engineers. It is built to help journalists, watchdogs, researchers, and citizens get to the point faster: what deserves attention, why it stands out, and where the official source is.

## What The Product Does

### 1. ContratoLimpio
Reads scored SECOP contract data and reorganizes it into a practical investigation flow:
- clear filters
- territorial risk map
- guided lead cases
- explainable factors behind each score
- direct jump back to the official SECOP record

The score is a **priority signal**, not an accusation.

### 2. Promesómetro
Tracks the distance between what politicians promise and what public evidence shows:
- promise source
- linked public action
- semantic similarity readout
- per-profile breakdowns
- readable NLP explanation instead of opaque jargon

The goal is not to declare “fulfilled” in a legal sense. The goal is to show whether there is visible public action that meaningfully matches the promise.

### 3. SigueElDinero
Planned network layer for:
- donors
- contractors
- officials
- recurring relationships
- concentration and capture patterns

## Why It Exists

Colombian public data is massive, messy, and often technically accessible but practically unreadable.

VeedurIA exists to close that gap.

Instead of asking users to start with raw tables, it starts with:
1. a useful slice
2. a lead signal
3. a concise explanation
4. the official source

That is the product philosophy across the whole stack.

## Product Stack

The repo is intentionally split:

- `web/`
  Next.js product shell for the landing page and public-facing modules
- `backend/`
  FastAPI layer that serves contract and promises payloads to the web app
- `src/`
  Python ingestion, feature engineering, model logic, and API services
- `data/`
  reference files, processed metadata, and local development artifacts

This keeps the heavy data and ML work in Python while shipping a real web product instead of a notebook-style interface.

## Current Experience

### Routes

- `/`
  product landing page
- `/contrato-limpio`
  contract risk reading experience
- `/promesmetro`
  promises vs evidence experience
- `/promesometro`
  alias redirect to `/promesmetro`
- `/sigue-el-dinero`
  placeholder for the next phase

### Design Direction

The current product direction is:
- editorial, not generic
- concise, not bloated
- explainable, not mystical
- source-first, not model-first

## Local Development

### 1. Backend

```bash
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```

### 2. Frontend

```bash
cd web
npm install
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 npm run dev
```

Then open:

```bash
http://localhost:3000
```

## Build Checks

Frontend production build:

```bash
cd web
npm run build
```

Backend syntax sanity check:

```bash
python3 -m py_compile backend/main.py src/api/contracts_service.py src/api/promises_service.py
```

## Data Notes

- processed datasets may live locally or in Supabase Storage
- GitHub tracks code, light reference data, metadata, and configuration
- the app includes fallback mock data so the web product can still render when the API is unavailable

## Core Technical Ideas

### Contract Scoring

ContratoLimpio uses anomaly-style scoring over public procurement records.

In plain language:
- the system learns what a more typical contract looks like
- it checks which contracts fall far away from that pattern
- it explains which factors pushed the case upward

This is useful for **preventive review**, not automatic judgment.

### Promise Linking

Promesómetro uses NLP to compare:
- the wording of the original promise
- the wording of legislative or executive actions

High similarity means the action is meaningfully close in topic and intent.
It does **not** automatically mean full policy fulfillment.

## Repo Guide

| Path | Purpose |
|---|---|
| `web/components/landing-page.tsx` | landing page |
| `web/components/contracts-view.tsx` | ContratoLimpio UI |
| `web/components/promises-view.tsx` | Promesómetro UI |
| `web/components/colombia-map.tsx` | reusable Colombia map |
| `web/components/site-nav.tsx` | shared product navigation |
| `backend/main.py` | FastAPI entrypoint |
| `src/api/contracts_service.py` | contracts payload builder |
| `src/api/promises_service.py` | promises payload builder |
| `CLAUDE.md` | architecture, workflows, and project context |

## Deployment

Typical deployment split:

- deploy `web/` to Vercel
- deploy `backend/` to Render, Railway, Fly.io, or equivalent
- set `NEXT_PUBLIC_API_BASE_URL` in the frontend environment

## Positioning

VeedurIA is trying to become a **public accountability surface** for Colombia:
- contracts
- promises
- money
- networks
- evidence

One product.
One reading flow.
No wasted clicks.

## Documentation

For deeper architecture and workflow notes, see [CLAUDE.md](CLAUDE.md).
