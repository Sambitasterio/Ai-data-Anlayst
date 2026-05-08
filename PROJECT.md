# AI Data Analyst

> **Talk to your data.** Upload a CSV / Excel file or connect a SQL database, ask questions in plain English, and get back charts, insights, and the generated SQL/Python code — all in a polished dashboard UI.

---

## Table of Contents

1. [Vision](#vision)
2. [Core Features](#core-features)
3. [Tech Stack](#tech-stack)
4. [Architecture](#architecture)
5. [Folder Structure](#folder-structure)
6. [Phases & Progress Tracker](#phases--progress-tracker)
7. [How to Command Me](#how-to-command-me)
8. [Setup (planned)](#setup-planned)
9. [Future Work](#future-work)

---

## Vision

Build an LLM-powered analytics tool that lowers the barrier to data analysis for non-technical users while still being useful for analysts. The agent reasons over a dataset, decides what to compute, runs sandboxed code, and returns visual answers — not just text.

**Example interactions:**

- *"Which 5 products had the biggest YoY revenue growth in Q4?"* → bar chart + table + the SQL it ran
- *"Build me a dashboard for monthly sales performance."* → multi-widget dashboard in one prompt
- *"Are there any anomalies in last week's data?"* → highlighted outliers + explanation

---

## Core Features

### MVP (v0.1)

- [ ] Upload CSV / Excel files
- [ ] Natural-language question → answer with chart + table
- [ ] Show generated SQL / Python code (with copy button)
- [ ] Streaming responses (token-by-token) using Vercel AI SDK
- [ ] Conversation memory (follow-up questions work)
- [ ] Dark / light mode

### v0.2

- [ ] Connect to live SQL databases (Postgres, MySQL, SQLite)
- [ ] Auto-generate full dashboards from a single prompt
- [ ] Save & share dashboards
- [ ] Scheduled refresh of saved queries

### v0.3

- [ ] Anomaly & trend detection ("what's interesting here?")
- [ ] Forecasting (Prophet / statsmodels)
- [ ] Multi-file joins ("compare orders.csv with customers.csv")
- [ ] Export reports to PDF / Notion

---

## Tech Stack

### Backend

| Layer | Choice | Why |
|---|---|---|
| API | **FastAPI** | Async, fast, easy SSE for streaming |
| LLM Orchestration | **LangChain + LangGraph** | Agent + tool-use + reasoning trace |
| LLM Provider | **OpenAI GPT-4o** *(swappable: Gemini, Groq, Ollama)* | Strong tool use & code generation |
| Data Engine | **DuckDB + Pandas** | SQL over CSVs in-memory, blazing fast |
| Charting | **Plotly** (server-rendered JSON specs) | Frontend can consume the same spec |
| Sandbox | **RestrictedPython / subprocess + resource limits** | Safe code execution |
| Vector Store *(for column docs)* | **Chroma** | Local, zero-setup |

### Frontend

| Layer | Choice |
|---|---|
| Framework | **Next.js 14 (App Router) + TypeScript** |
| Styling | **Tailwind CSS + shadcn/ui** |
| Animations | **Framer Motion** |
| State / Data | **TanStack Query + Zustand** |
| Streaming | **Vercel AI SDK** (`useChat` hook) |
| Charts | **Plotly.js + Recharts** (Plotly for complex, Recharts for simple) |
| Tables | **TanStack Table** |
| Code Display | **Shiki** (syntax-highlighted SQL/Python) |
| File Upload | **react-dropzone** |

---

## Architecture

```
┌─────────────────┐         ┌──────────────────────────────┐
│   Next.js UI    │◄──SSE──►│   FastAPI + LangGraph Agent  │
│  (Vercel AI SDK)│         │                              │
└────────┬────────┘         │  ┌────────────────────────┐  │
         │                  │  │ Tools:                 │  │
         │ upload           │  │  - run_sql (DuckDB)    │  │
         ▼                  │  │  - run_python (sandbox)│  │
   ┌──────────┐             │  │  - make_chart (Plotly) │  │
   │ /uploads │◄────────────┤  │  - describe_columns    │  │
   └──────────┘             │  └────────────────────────┘  │
                            └──────────────┬───────────────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │   OpenAI    │
                                    └─────────────┘
```

**Agent loop (LangGraph):**

1. **Plan** node → decides if question needs SQL, Python, or just an explanation
2. **Execute** node → calls the right tool
3. **Reflect** node → checks result, retries if error, formats final answer
4. **Stream** → sends thoughts + final answer + chart spec to frontend

---

## Folder Structure

```
ai-data-analyst/
├── PROJECT.md                  ← you are here
├── README.md                   (quickstart — to be added)
├── .env.example
├── .gitignore
│
├── backend/
│   ├── app/
│   │   ├── main.py             FastAPI entrypoint
│   │   ├── agent/
│   │   │   ├── graph.py        LangGraph definition
│   │   │   ├── tools.py        SQL / Python / chart tools
│   │   │   └── prompts.py
│   │   ├── api/
│   │   │   ├── chat.py         /chat (SSE streaming)
│   │   │   └── upload.py       /upload
│   │   ├── core/
│   │   │   ├── duckdb_engine.py
│   │   │   ├── sandbox.py
│   │   │   └── config.py
│   │   └── schemas.py
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
│
└── frontend/
    ├── app/
    │   ├── page.tsx            Landing
    │   ├── chat/page.tsx       Chat + dashboard
    │   └── api/chat/route.ts
    ├── components/
    │   ├── chat/               messages, input, streaming
    │   ├── dashboard/          chart-card, dashboard-grid
    │   ├── upload/             dropzone, file-preview
    │   └── ui/                 shadcn primitives
    ├── lib/
    │   ├── api.ts
    │   └── plotly-loader.ts
    ├── package.json
    └── tailwind.config.ts
```

---

## Phases & Progress Tracker

> Update the status emoji in the table when a phase changes state. Each phase below has its own checklist of sub-tasks. When you want me to start a phase, just say `start phase N` (or use any of the shortcut commands listed in the next section).

### Status Legend

| Symbol | Meaning |
|---|---|
| ⬜ | Not started |
| 🟡 | In progress |
| ✅ | Done |
| ⏸️ | Paused / blocked |
| ⏭️ | Skipped (decided not to do) |

### Master Phase Table

| # | Phase | Status | Owner | Command to start |
|---|---|---|---|---|
| 0 | Project bootstrap (folders, .env, .gitignore, git init) | 🟡 | — | `start phase 0` |
| 1 | Backend scaffold (FastAPI skeleton, health route) | ⬜ | — | `start phase 1` |
| 2 | Data ingestion (CSV upload → DuckDB) | ⬜ | — | `start phase 2` |
| 3 | Basic LangChain agent with `run_sql` tool | ⬜ | — | `start phase 3` |
| 4 | Streaming `/chat` endpoint (SSE) | ⬜ | — | `start phase 4` |
| 5 | Frontend scaffold (Next.js + Tailwind + shadcn) | ⬜ | — | `start phase 5` |
| 6 | Chat UI with Vercel AI SDK streaming | ⬜ | — | `start phase 6` |
| 7 | File upload UI (dropzone + preview) | ⬜ | — | `start phase 7` |
| 8 | Add `run_python` + `make_chart` tools | ⬜ | — | `start phase 8` |
| 9 | LangGraph multi-node flow (Plan → Execute → Reflect) | ⬜ | — | `start phase 9` |
| 10 | Plotly chart rendering on frontend | ⬜ | — | `start phase 10` |
| 11 | Code preview panel (Shiki SQL/Python highlighting) | ⬜ | — | `start phase 11` |
| 12 | Conversation memory + history sidebar | ⬜ | — | `start phase 12` |
| 13 | Dashboard layout (drag-resize chart cards) | ⬜ | — | `start phase 13` |
| 14 | Polish: dark mode, animations, error states, skeletons | ⬜ | — | `start phase 14` |
| 15 | SQL DB connector (Postgres / MySQL / SQLite) | ⬜ | — | `start phase 15` |
| 16 | Save / share dashboards (persistence) | ⬜ | — | `start phase 16` |
| 17 | Tests (pytest backend + Playwright e2e) | ⬜ | — | `start phase 17` |
| 18 | Deploy (Vercel frontend + Fly.io/Railway backend) | ⬜ | — | `start phase 18` |

---

### Phase 0 — Project bootstrap

- [x] `backend/` and `frontend/` folders created
- [x] `.gitignore` (Python + Node)
- [x] `.env.example` with placeholder keys
- [ ] `git init` + initial commit
- [x] Root `README.md` with quickstart

### Phase 1 — Backend scaffold

- [ ] `requirements.txt` (fastapi, uvicorn, pydantic, python-dotenv)
- [ ] `app/main.py` with FastAPI app + CORS
- [ ] `GET /health` route returning `{"status": "ok"}`
- [ ] `app/core/config.py` loading env vars
- [ ] Verify `uvicorn app.main:app --reload` runs

### Phase 2 — Data ingestion

- [ ] Add `duckdb` and `pandas` to requirements
- [ ] `POST /upload` accepts CSV/Excel multipart upload
- [ ] Files saved to `backend/uploads/` with UUID filename
- [ ] `app/core/duckdb_engine.py` registers each upload as a DuckDB view
- [ ] `GET /datasets` lists uploaded files + their columns/dtypes
- [ ] `GET /datasets/{id}/preview` returns first 20 rows

### Phase 3 — Basic LangChain agent

- [ ] Add `langchain`, `langchain-openai` to requirements
- [ ] `app/agent/tools.py` → `run_sql(query, dataset_id)` tool
- [ ] `app/agent/prompts.py` → system prompt with column schema injected
- [ ] `app/agent/graph.py` → simple agent (no LangGraph yet, just AgentExecutor)
- [ ] Test: ask "how many rows?" on a sample CSV

### Phase 4 — Streaming `/chat` endpoint

- [ ] `POST /chat` accepts `{messages, dataset_id}`
- [ ] Returns Server-Sent Events stream
- [ ] Streams agent thoughts + final answer
- [ ] Test with `curl --no-buffer`

### Phase 5 — Frontend scaffold

- [ ] `npx create-next-app@latest frontend --ts --tailwind --app`
- [ ] Install `shadcn/ui` + add Button, Card, Input, ScrollArea
- [ ] Install `framer-motion`, `@tanstack/react-query`, `zustand`
- [ ] Configure dark mode (`next-themes`)
- [ ] Landing page with hero + "Get Started" CTA

### Phase 6 — Chat UI with streaming

- [ ] Install `ai` (Vercel AI SDK)
- [ ] `app/api/chat/route.ts` proxies to FastAPI SSE
- [ ] `components/chat/chat-window.tsx` using `useChat`
- [ ] Message bubbles (user vs assistant) with markdown rendering
- [ ] Auto-scroll on new tokens
- [ ] Stop / regenerate buttons

### Phase 7 — File upload UI

- [ ] `react-dropzone` integration
- [ ] `components/upload/dropzone.tsx` with drag-and-drop animation
- [ ] Show file preview (first 20 rows in a TanStack Table)
- [ ] Dataset switcher in chat header

### Phase 8 — More tools

- [ ] `run_python(code, dataset_id)` tool with sandboxed exec
- [ ] `make_chart(spec)` tool returning Plotly JSON
- [ ] Tool-use logging (which tool ran, args, result)

### Phase 9 — LangGraph flow

- [ ] Refactor agent into LangGraph: Plan → Execute → Reflect → Respond
- [ ] Retry-on-error logic in Reflect node
- [ ] Stream node transitions to frontend (for the "thinking" sidebar)

### Phase 10 — Plotly on frontend

- [ ] Dynamic-import `react-plotly.js` (avoid SSR issues)
- [ ] `components/dashboard/chart-card.tsx`
- [ ] Render charts inline in chat messages
- [ ] Resize / fullscreen / export-as-PNG buttons

### Phase 11 — Code preview panel

- [ ] Install `shiki`
- [ ] Collapsible "Show code" section on each assistant message
- [ ] SQL + Python tabs
- [ ] Copy-to-clipboard button

### Phase 12 — Memory & history

- [ ] Backend: store conversations (SQLite via SQLAlchemy)
- [ ] `GET /conversations` + `GET /conversations/{id}`
- [ ] Frontend: sidebar with past conversations
- [ ] New chat / delete chat / rename chat

### Phase 13 — Dashboard layout

- [ ] `react-grid-layout` for drag-resize cards
- [ ] "Pin to dashboard" button on any chart
- [ ] Save dashboard layout per conversation

### Phase 14 — Polish

- [ ] Loading skeletons everywhere
- [ ] Error toasts (sonner)
- [ ] Empty states with illustrations
- [ ] Framer Motion page transitions
- [ ] Mobile-responsive chat
- [ ] Keyboard shortcuts (Cmd+K palette)

### Phase 15 — SQL DB connector

- [ ] Connection form (host, port, user, pass, db)
- [ ] Encrypted credential storage
- [ ] Schema introspection → inject into agent prompt
- [ ] Read-only SQL guardrail

### Phase 16 — Save / share

- [ ] User auth (NextAuth — magic link or GitHub)
- [ ] Public share links for dashboards
- [ ] Permissions (view / edit)

### Phase 17 — Tests

- [ ] `pytest` for backend (agent tools, API routes)
- [ ] Playwright e2e: upload → ask question → see chart
- [ ] GitHub Actions CI

### Phase 18 — Deploy

- [ ] Dockerize backend
- [ ] Deploy backend to Fly.io or Railway
- [ ] Deploy frontend to Vercel
- [ ] Custom domain + HTTPS
- [ ] Demo dataset preloaded for visitors

---

## How to Command Me

You don't need to memorize phase numbers. Any of these styles work — I'll figure out the rest:

### Phase commands

| Command | What I'll do |
|---|---|
| `start phase N` | Begin phase N from the table above; flip status to 🟡 and start coding |
| `finish phase N` | Mark phase N as ✅ in the table |
| `pause phase N` | Mark phase N as ⏸️ |
| `skip phase N` | Mark phase N as ⏭️ and move on |
| `status` | I'll print the current phase table with live statuses |
| `next` | I'll suggest and start the next logical phase |

### Shortcut commands (no phase number needed)

| Command | Equivalent phase |
|---|---|
| `scaffold backend` | Phases 0 + 1 |
| `scaffold frontend` | Phase 5 |
| `add upload` | Phases 2 + 7 |
| `wire up the agent` | Phases 3 + 4 |
| `make it pretty` | Phase 14 |
| `ship it` | Phases 17 + 18 |

### Modifier commands

- `with gemini` / `with groq` / `with ollama` → switch the LLM provider for the current phase
- `dry run phase N` → I'll just outline what I'd do without writing code
- `redo phase N` → reset and rebuild that phase from scratch

> **Convention:** every time I complete a phase, I'll update the Master Phase Table status, tick its sub-task checkboxes, and tell you which phase is next.

---

## Setup (planned)

```bash
# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

Required env vars (`.env`):

```
OPENAI_API_KEY=sk-...
# optional
GEMINI_API_KEY=
GROQ_API_KEY=
```

---

## Future Work

### Next project after this: **Travel Planner Agent**

A multi-tool LangChain agent that takes a prompt like *"5 days in Tokyo, $2000 budget, vegetarian"* and produces a full day-by-day itinerary with maps, weather, and bookings.

**Planned tech:**

- **Backend**: FastAPI + LangChain agents + tool-use (Google Maps, OpenWeatherMap, Wikipedia, Amadeus flights/hotels API)
- **Frontend**: Next.js + Mapbox/Leaflet, draggable timeline, animated itinerary cards
- **Wow factor**: Live agent reasoning trace shown as a "thought bubble" sidebar; click a stop on the map → scrolls to that day in the itinerary

**Why it's a good follow-up to AI Data Analyst:**

- Reuses the same agent + streaming + Next.js stack we'll build here
- Adds *external API tool-use* (vs the data-analyst's *internal compute tools*)
- Strong visual demo (maps + timelines) that pairs well with the analytics dashboard for a portfolio

### Other ideas parked for later

- Autonomous Research Agent (mini-Perplexity, LangGraph multi-agent)
- Voice-First Meeting Notetaker (Whisper + RAG + audio sync)
- AI Code Reviewer for GitHub PRs

---

## License

MIT (planned)
