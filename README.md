# AI Data Analyst

Talk to your data with a full-stack app:
- upload CSV/Excel
- ask natural-language questions
- execute SQL/Python tool paths
- stream responses in chat UI

This README reflects the current build status through **Phase 9**.

## Current Status

Completed phases:
- Phase 0: project bootstrap
- Phase 1: backend scaffold
- Phase 2: data ingestion (upload + dataset registry + preview)
- Phase 3: basic LangChain agent setup
- Phase 4: backend SSE `/chat`
- Phase 5: frontend scaffold + shadcn + dark mode
- Phase 6: chat UI with Vercel AI SDK streaming integration
- Phase 7: file upload UI + dataset switcher + preview table
- Phase 8: `run_python` + `make_chart` tools + tool-use logging
- Phase 9: LangGraph flow (`Plan -> Execute -> Reflect -> Respond`) + retry path

## Project Structure

```text
ai-data-analyst/
├── backend/
│   ├── app/
│   │   ├── api/        # upload/chat routes
│   │   ├── agent/      # graph, prompts, tools
│   │   ├── core/       # config, duckdb engine
│   │   └── schemas.py
│   └── requirements.txt
├── frontend/
│   ├── app/            # Next.js app router pages + api proxy
│   ├── components/     # chat, upload, ui
│   └── lib/            # frontend API helpers
├── PROJECT.md          # phase tracker and roadmap
└── COMMANDS.md         # command cheat sheet
```

## Prerequisites

- Python 3.11+ (or compatible environment already used in project)
- Node.js `>=20.9.0` recommended for current Next.js setup
- npm

## Setup

### 1) Backend

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend base URL: `http://127.0.0.1:8000`
Docs: `http://127.0.0.1:8000/docs`

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend URL: `http://localhost:3000`
Chat page: `http://localhost:3000/chat`

## Environment Variables

Copy `.env.example` to `.env` at repo root:

```bash
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=
GROQ_API_KEY=
```

Notes:
- App works without `OPENAI_API_KEY` using fallback logic.
- With OpenAI key configured, agent tool routing becomes model-driven.

## What Works Right Now

### Backend
- Health route: `GET /health`
- Upload route: `POST /upload` for CSV/XLS/XLSX
- Dataset listing: `GET /datasets`
- Dataset preview: `GET /datasets/{id}/preview`
- SSE chat: `POST /chat`
- Agent graph transitions streamed as thought events

### Agent Tools
- `run_sql(query, dataset_id)` (read-only select)
- `run_python(code, dataset_id)` over dataframe `df`
- `make_chart(spec)` returns validated Plotly JSON
- tool-use logging in backend logs

### Frontend
- Landing page + dark mode toggle
- Chat interface with streaming messages
- Upload dropzone UI
- Dataset switcher in chat header
- Preview table for uploaded data
- Stop and regenerate controls

## API Quick Reference

### Upload dataset

```bash
curl -X POST http://127.0.0.1:8000/upload -F "file=@sample_dataset.csv"
```

### List datasets

```bash
curl http://127.0.0.1:8000/datasets
```

### Preview dataset

```bash
curl http://127.0.0.1:8000/datasets/<DATASET_ID>/preview
```

### Test backend chat stream

```bash
curl --no-buffer -N \
  -H "Content-Type: application/json" \
  -d '{"dataset_id":"<DATASET_ID>","messages":[{"role":"user","content":"how many rows?"}]}' \
  http://127.0.0.1:8000/chat
```

## Known Limitations

- Dataset registry is in-memory; after backend restart, re-upload files.
- Frontend currently displays chart specs as text; chart rendering phase is upcoming.
- Additional sandbox hardening for Python execution is still planned.

## Next Planned Phase

Phase 10: render Plotly chart specs in frontend chat as actual charts.
