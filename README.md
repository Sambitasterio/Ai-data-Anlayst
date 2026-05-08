# AI Data Analyst

Talk to your data: upload CSV/Excel, ask questions in plain English, and get charts, tables, and generated SQL/Python.

## Quickstart

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Environment variables

Copy `.env.example` to `.env` and fill in values:

```bash
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=
GROQ_API_KEY=
```
