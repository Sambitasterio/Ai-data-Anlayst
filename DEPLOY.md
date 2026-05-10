# Deploy (Phase 18)

This app is deployed as:

- **API**: Docker image (Fly.io **or** Railway **or** any container host).
- **Frontend**: Vercel (recommended for Next.js) or another Node host pointing at `BACKEND_URL`.

HTTPS and custom domains are configured in each provider’s dashboard (not in-repo).

---

## Environment variables — API container

| Variable | Required | Notes |
|----------|----------|-------|
| `JWT_SECRET` | Yes (production) | Long random string. |
| `OPENAI_API_KEY` | Recommended | NL→SQL and LLM flows. |
| `DATABASE_URL` | Optional | Default: `sqlite:///` + `./backend/app.db` under BASE_DIR. For Fly/Railway with volume: `sqlite:////data/app.db`. |
| `CORS_ORIGINS` | Recommended | Comma-separated origins — your Vercel URL(s), no trailing slash mismatch. Example: `https://myapp.vercel.app`. Use `*` only for demos. |
| `AUTOLOAD_DEMO_SAMPLE` | Optional | Set `1` to register bundled `demo_sample.csv` when no datasets exist yet. |
| `PORT` | Optional | Listening port inside container (default `8000`). Fly/Railway inject `PORT` automatically. |

Match **Auth sync** secrets with the frontend `.env.local` (`AUTH_SYNC_SECRET`, GitHub OAuth) as in README.

---

## Local Docker Compose

From repo root (where `Dockerfile` and `docker-compose.yml` live):

```bash
docker compose build
JWT_SECRET="$(openssl rand -base64 32)" docker compose up
```

Inspect `GET http://localhost:8000/datasets` — with `AUTOLOAD_DEMO_SAMPLE=1` you should see one demo dataset.

---

## Fly.io (API)

1. Install [Fly CLI](https://fly.io/docs/getting-started/installing-flyctl/), run `fly auth login`.
2. Edit `fly.toml`: set unique `app = "your-api-name"` and `primary_region`.
3. Set secrets:  
   `fly secrets set JWT_SECRET=... OPENAI_API_KEY=... CORS_ORIGINS=https://YOUR_VERCEL.vercel.app`
4. For persistent SQLite + uploads, attach a **[volume](https://fly.io/docs/reference/volumes/)** mounted at `/data` and set  
   `fly secrets set DATABASE_URL=sqlite:////data/app.db`
5. Deploy:  
   `fly deploy`

---

## Railway (API)

1. New Project → Deploy from repo with **Dockerfile** at root (already referenced in `railway.toml`).
2. Add variables in Railway dashboard mirroring the table above; set **`PORT`** if the platform exposes it dynamically.
3. Mount a persistent volume bound to `/data` if using `DATABASE_URL=sqlite:////data/app.db`.

---

## Vercel (Frontend)

1. Import the **`frontend`** directory as the Vercel project root *(or deploy monorepo with “Root Directory” = `frontend`)*.
2. Environment variables:

   | Variable | Notes |
   |----------|-------|
   | `BACKEND_URL` | Public HTTPS URL of the API (`https://...`) |
   | `AUTH_SECRET` or `NEXTAUTH_SECRET` | NextAuth encryption secret |
   | `NEXTAUTH_URL` | `https://YOUR_VERCEL_HOST` |

3. Deploy. Update API `CORS_ORIGINS` to include this exact URL.

---

## Custom domain & HTTPS

- **Vercel**: Project → Domains → add apex or `www`; TLS is automatic.
- **Fly / Railway**: Add custom domain in their UI; DNS CNAME/A per provider docs.

---

## Rollback / health

- Probe `GET /health` behind your load balancer.
- Pin releases by tagging Docker images or using provider release history.
