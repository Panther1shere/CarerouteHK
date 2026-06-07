# Housing Policy Loop Navigator

Housing Policy Loop Navigator is a hackathon-ready B2G demo for city housing teams. It helps a policy analyst test a housing intervention, trace stakeholder and system loops, identify failure paths, and review safer intervention points before a policy is launched.

The stack is:

- TanStack Start / React frontend for the policy workbench
- FastAPI backend for policy analysis, intervention guidance, and drafting support
- PostgreSQL for saved policy analyses and system maps

## What the demo does

- Accepts housing policy text and saves a full backend analysis
- Generates stakeholders with Micro, Meso, and Macro analysis
- Stores nodes, connections, feedback loops, system boundary, and notes
- Returns intervention analysis with explicit reasoning and tradeoffs
- Returns policy-enhancement guidance for what to add back into the policy text

## API surface

- `POST /policy`
- `GET /policy`
- `GET /policy/{policyId}`
- `GET /policy/{policyId}/interventions/analysis`
- `GET /policy/{policyId}/policy-enhancements`
- `GET /healthz`

## Project structure

```text
.
├── backend
│   ├── app
│   │   ├── advisor.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── main.py
│   │   ├── repository.py
│   │   ├── schemas.py
│   │   ├── seed_data.py
│   │   └── simulation.py
│   ├── Dockerfile
│   └── requirements.txt
├── new-frontend
│   ├── src
│   │   ├── lib
│   │   │   └── backend-policy.functions.ts
│   │   ├── routes
│   │   │   ├── __root.tsx
│   │   │   └── index.tsx
│   │   └── styles.css
│   ├── Dockerfile
│   ├── package.json
│   └── vite.config.ts
├── understand.md
├── .env
├── .env.example
└── docker-compose.yml
```

## Run locally with Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Open:

- Frontend: [http://localhost:4200](http://localhost:4200)
- API docs: [http://localhost:8000/swagger-ui/index.html](http://localhost:8000/swagger-ui/index.html)
- Health check: [http://localhost:8000/healthz](http://localhost:8000/healthz)

## Useful commands

```bash
docker compose up --build -d
docker compose logs -f backend
docker compose logs -f frontend
docker compose down
docker compose down -v
```

## Demo flow

1. Open the workbench.
2. Paste a housing policy.
3. Run the backend analysis.
4. Review stakeholders, intervention reasoning, and policy enhancements.
5. Reopen saved analyses from the right-hand panel.

## Frontend-Driven Integration

This repo now follows a frontend-driven integration model for the policy wizard.

1. Map the frontend contract first.
   The active UI contract is defined by `new-frontend/src/lib/policygraph/analyze.functions.ts` and the wizard components that consume the `PolicyAnalysis` payload.

2. Shape backend responses to that contract.
   The backend exposes adapter endpoints that return the exact JSON structure the frontend already expects:
   - `POST /api/frontend/policygraph/analyze`
   - `POST /api/frontend/policygraph/datasets/search`
   - `POST /api/frontend/policygraph/chat`

3. Keep formatting logic in the backend.
   The backend now handles dataset suggestion, policy persistence, stakeholder mapping, loop formatting, impact estimation, warning generation, bundle generation, and grounded chat responses so the frontend can render with minimal transformation.

4. Limit frontend changes to transport only.
   The wizard steps still call the same exported server functions. Those functions now proxy to the backend adapter routes instead of running the analysis pipeline locally.

## Notes

- The frontend service is now sourced from `new-frontend/`; the old Angular frontend has been retired.
- The intervention and enhancement views are backed by persisted backend policy analysis endpoints.
- `understand.md` contains the product brief, technical concept note, and B2G pitch framing.
