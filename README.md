# AI Data Analyst

Talk to your data with a full-stack app:
- upload CSV/Excel
- ask natural-language questions
- execute SQL/Python tool paths
- stream responses in chat UI

This README reflects the current build status through **Phase 18** (deploy scaffolding + Docker).

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
- Phase 10: Plotly chart rendering inline in chat
- Phase 11: Shiki-powered code preview panel (SQL/Python tabs + copy)
- Phase 12: conversation memory + history sidebar (new/rename/delete + reload)
- Phase 13: dashboard layout with pin-able, drag-resize chart cards per conversation
- Phase 14: polish pass (skeletons, toasts, empty states, transitions, mobile UI, command palette)
- Phase 15: SQL DB connector (Postgres/MySQL/SQLite) with encrypted credentials + schema-aware prompts
- Phase 16: accounts + JWT API, NextAuth (credentials + optional GitHub), dashboard share links (view/edit)
- Phase 17: pytest (agent + DuckDB + API health) + Playwright smoke + GitHub Actions CI
- Phase 18: Docker backend image, Compose, Fly/Railway stubs, Vercel + domain guidance (`DEPLOY.md`), optional demo CSV autoload (`AUTOLOAD_DEMO_SAMPLE`)

## Project Structure

```text
ai-data-analyst/
├── backend/
│   ├── app/
│   │   ├── api/        # upload/chat/conversation routes
│   │   ├── agent/      # graph, prompts, tools
│   │   ├── core/       # config, duckdb engine, sqlite database
│   │   ├── models.py   # SQLAlchemy conversation models
│   │   └── schemas.py  # API request/response schemas
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

### Tests (Phase 17)

**Backend (pytest):** run from the **`backend/`** folder (or use the paths below from the repo root).

```bash
cd backend
pip install -r requirements.txt -r requirements-dev.txt
pytest tests -q --tb=short
```

From repo root (parent of `backend/` and `frontend/`):

```bash
pip install -r backend/requirements.txt -r backend/requirements-dev.txt
cd backend && pytest tests -q --tb=short
```

**Frontend (Playwright):** requires a production build and auth env vars (same as `.env.local`), then:

```bash
cd frontend
npm install
npm run build
npx playwright install chromium   # first time only
PLAYWRIGHT_WEBSERVER_COMMAND="npm run start -- -p 3000" npm run test:e2e
```

On GitHub Actions, `frontend` job runs `npm run build`, installs Chromium, and executes `npm run test:e2e` with the web server started by Playwright.

### Deploy (Docker + hosts)

See **[DEPLOY.md](./DEPLOY.md)** for **`docker compose`**, Fly.io, Railway, Vercel, **`CORS_ORIGINS`**, and **`DATABASE_URL`**.

Quick Compose from repo root:

```bash
docker compose build && docker compose up
```

API defaults to `:8000` with a demo dataset seeded when **`AUTOLOAD_DEMO_SAMPLE=1`** (Compose default).

## Environment Variables

Copy `.env.example` to `.env` at repo root (backend), and create `frontend/.env.local` for NextAuth:

**Repo root `.env` (backend):** include at least `JWT_SECRET`, and `AUTH_SYNC_SECRET` if you use GitHub sign-in.

**`frontend/.env.local`:**

```bash
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
AUTH_SYNC_SECRET=<same value as backend AUTH_SYNC_SECRET>
BACKEND_URL=http://127.0.0.1:8000
# Optional GitHub OAuth
GITHUB_ID=
GITHUB_SECRET=
```

Notes:
- App works without `OPENAI_API_KEY` using fallback logic.
- Signed-in users only see their own conversations; unsigned users only see conversations with no owner (legacy anonymous chats).
- Share links are public: `/share/<token>` (no login).

## What Works Right Now

### Backend
- Health route: `GET /health`
- Upload route: `POST /upload` for CSV/XLS/XLSX
- Dataset listing: `GET /datasets`
- Dataset preview: `GET /datasets/{id}/preview`
- SSE chat: `POST /chat`
- Conversation history list/detail: `GET /conversations`, `GET /conversations/{id}` (optional `Authorization: Bearer <jwt>`)
- Conversation actions: `POST /conversations`, `PATCH /conversations/{id}`, `DELETE /conversations/{id}`
- Auth: `POST /auth/register`, `POST /auth/login`, `POST /auth/oauth-sync` (internal, for GitHub sync)
- Shared dashboard (public): `GET /shared/{token}`, `PATCH /shared/{token}/dashboard` (if share permission is `edit`)
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
- Conversation history sidebar
- Conversation dashboard persistence (`PATCH /conversations/{id}/dashboard`)
- Preview table for uploaded data
- Stop and regenerate controls
- Inline Plotly chart rendering for assistant chart specs
- Chart controls: resize, fullscreen, export PNG
- Pin chart to dashboard + drag/resizable dashboard cards
- Collapsible code preview with SQL/Python tabs and copy button
- Skeleton loading states for datasets/history/chat responses
- Toast notifications for API/UI errors and conversation actions
- Empty states for conversations, datasets, and chat start
- Framer Motion entry transitions for chat page and message items
- Mobile-friendly chat layout with togglable history panel
- Keyboard shortcut palette (`Ctrl/Cmd + K`) for quick actions
- SQL connector form (host/port/user/password/database or SQLite path)
- External SQL source selection in chat dataset picker
- Automatic schema introspection attached to agent context for SQL sources
- Read-only SQL guardrails for internal and external query execution
- Register / login pages (`/register`, `/login`); session forwards JWT to `/api/chat` and conversation APIs
- Copy **view** or **edit** share links from the chat dashboard (owner must be signed in)
- Public **view-only** or **collaborative edit** dashboard at `/share/{token}` (`DashboardGrid` read-only or draggable)

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
- Conversation history is persisted in SQLite, but linked dataset IDs may become stale after backend restart.
- Chats created while logged out are not migrated when you sign in (they stay in the anonymous list).
- Additional sandbox hardening for Python execution is still planned.

## Next Planned Phase

Phase 17: automated tests (pytest + Playwright) and CI.
