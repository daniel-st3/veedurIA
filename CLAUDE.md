# CLAUDE.md — VeedurIA Repository Guide

This file is the concise operating guide for contributors and coding agents.

## Product

VeedurIA is a civic intelligence product for reading public power in Colombia.

Current public modules:
- `ContratoLimpio`
- `Promesómetro`
- `SigueElDinero` placeholder

The product principle is simple:
- show what deserves attention
- explain why it stands out
- send the user back to the official source

## Stack

- `web/`
  Next.js frontend and public product shell
- `backend/`
  FastAPI server consumed by the frontend
- `src/`
  Python services for ingestion, processing, scoring, and payload shaping
- `pages/`
  legacy Streamlit pages still present in the repo, but no longer the primary product surface

## Keep / Remove Philosophy

Keep documentation only if it helps with one of these:
- understanding the product
- running the app locally
- deploying or maintaining the data/model pipeline
- preserving project-specific engineering rules

Do not keep sprint notes, temporary plans, or archived implementation checklists in the main repo.

## Non-Negotiable Language Rules

Never frame model output as confirmed wrongdoing.

Prefer:
- `alerta preventiva`
- `patrón atípico`
- `señal`
- `prioridad de revisión`

Avoid:
- `corrupción confirmada`
- `fraude probado`
- `ilegal` as a model conclusion

## Current Repo Layout

```text
README.md
CLAUDE.md
backend/
src/
web/
data/reference/
tests/
.claude/rules/
```

## Main Runtime Paths

- landing:
  `web/app/page.tsx`
- contracts:
  `web/components/contracts-view.tsx`
- promises:
  `web/components/promises-view.tsx`
- backend entry:
  `backend/main.py`
- contract payloads:
  `src/api/contracts_service.py`
- promise payloads:
  `src/api/promises_service.py`

## Local Commands

Backend:

```bash
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```

Frontend:

```bash
cd web
npm install
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 npm run dev
```

Frontend production check:

```bash
cd web
npm run build
```

Python syntax check:

```bash
python3 -m py_compile backend/main.py src/api/contracts_service.py src/api/promises_service.py
```

## Data / Model Rules

- Do not commit raw SECOP dumps or large processed Parquet files
- Keep model metadata JSONs and small reference data under version control
- Keep API tokens and secrets out of source control
- If model behavior changes materially, keep explanations readable in the UI

## Documentation To Keep

- `README.md`
  product-facing overview and setup
- `CLAUDE.md`
  concise repo operating guide
- `.claude/rules/*.md`
  project-specific engineering and ML guardrails

## Before Pushing

For frontend work:
- run `npm run build` in `web/`

For backend or payload work:
- run the Python syntax check above

For risky logic changes:
- run the relevant tests in `tests/`

## Source Of Truth

When `README.md` and older implementation details disagree, prefer the current product architecture:
- Next.js frontend
- FastAPI backend
- Python data and scoring services
