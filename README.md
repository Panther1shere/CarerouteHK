# PolicyGraph HK

PolicyGraph HK is a decision-support workbench for housing policy teams. It maps stakeholders, causal relationships, feedback loops, and intervention points so a policy can be evaluated before it is launched.

The product does not try to replace policy judgment. It makes the system visible: who is affected, where incentives shift, which loops amplify risk, and which intervention has the clearest leverage.

## Demo

Run the fixed demo at:

- App: `http://localhost:4200/demo`
- Policy: vacancy tax on idle private flats

The demo uses backend-served mock data and shows a complete policy story: stakeholders, causal graph, reinforcing and balancing loops, a leverage point, and weak-vs-strong intervention comparison.

## How It Works

1. The analyst enters or opens a housing policy analysis.
2. The backend stores the policy history and system map in PostgreSQL.
3. The frontend renders the policy journey: stakeholders, system graph, feedback loops, interventions, and comparison.
4. The intervention view highlights how a policy affects specific nodes and how the ripple effect moves through the system.

## Stack

- Frontend: TanStack Start, React, Tailwind CSS
- Backend: FastAPI, SQLAlchemy, asyncpg
- Database: PostgreSQL
- Policy reasoning: backend analysis service with optional OpenAI support

## Run

```bash
cp .env.example .env
docker compose up --build
```

Open:

- Frontend: `http://localhost:4200`
- Demo: `http://localhost:4200/demo`
- API docs: `http://localhost:8000/swagger-ui/index.html`
- Health: `http://localhost:8000/healthz`

## Repository

```text
backend/
  app/                 FastAPI app, policy analysis, persistence, demo payload
new-frontend/
  src/components/      App UI, policy graph, wizard components
  src/lib/             Server functions and frontend data contracts
  src/routes/          TanStack routes including / and /demo
docker-compose.yml     Frontend, backend, and Postgres services
HONESTY.md             Hackathon disclosure template
```

## Useful Commands

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose down
docker compose down -v
```

Frontend checks:

```bash
cd new-frontend
npm run build
npm run lint
```

Backend check:

```bash
python -m py_compile backend/app/*.py
```

## Notes

- `/demo` is intentionally fixed data so the project can be presented reliably.
- Normal policy analyses are persisted through the backend and shown from saved history.
- Set `OPENAI_API_KEY` in `.env` for live policy analysis and chat support.
