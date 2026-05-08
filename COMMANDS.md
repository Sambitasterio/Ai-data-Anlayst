# AI Data Analyst Commands

## Backend

```bash
cd /c/AIML/ai-data-analyst/backend
source .venv/Scripts/activate
uvicorn app.main:app --reload
```

### Health check

```bash
curl http://127.0.0.1:8000/health
```

### Upload CSV

```bash
curl -X POST http://127.0.0.1:8000/upload -F "file=@sample_dataset.csv"
```

### Upload CSV from another folder

```bash
curl -X POST http://127.0.0.1:8000/upload -F "file=@/c/Users/SAMBIT/Downloads/your_file.csv"
```

### List datasets

```bash
curl http://127.0.0.1:8000/datasets
```

### Preview dataset (first 20 rows)

```bash
curl http://127.0.0.1:8000/datasets/<DATASET_ID>/preview
```

### Test SSE chat in terminal

```bash
curl --no-buffer -N \
  -H "Content-Type: application/json" \
  -d '{"dataset_id":"<DATASET_ID>","messages":[{"role":"user","content":"how many rows?"}]}' \
  http://127.0.0.1:8000/chat
```

## Frontend

```bash
cd /c/AIML/ai-data-analyst/frontend
npm install
npm run dev
```

### Open pages

- Landing: `http://localhost:3000`
- Chat UI: `http://localhost:3000/chat`
- Backend docs: `http://127.0.0.1:8000/docs`

## Common Troubleshooting

### Backend not reachable (`curl: (7) Failed to connect`)

Start backend again:

```bash
cd /c/AIML/ai-data-analyst/backend
source .venv/Scripts/activate
uvicorn app.main:app --reload
```

### Dataset ID not found after restart

Re-upload file and use the new ID:

```bash
curl -X POST http://127.0.0.1:8000/upload -F "file=@sample_dataset.csv"
```

### Kill stuck frontend process (Git Bash-safe)

```bash
cmd.exe /c "taskkill /IM node.exe /F"
```
