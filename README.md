# Housing Policy Loop Navigator

Housing Policy Loop Navigator is a hackathon-ready B2G demo for city housing teams. It helps a policy analyst test a housing intervention, trace stakeholder and system loops, identify failure paths, and review safer intervention points before a policy is launched.

The stack is:

- Angular frontend for the analyst dashboard
- FastAPI backend for seeded scenario loading, simulation, and intervention ranking
- PostgreSQL for the seeded city model and simulation runs

## What the demo does

- Loads a seeded city called `Harborview`
- Visualizes a causal housing-policy graph with stakeholder, factor, and policy nodes
- Highlights reinforcing loops that make policy fail
- Simulates housing policy changes with deterministic scoring
- Ranks intervention options with explainable tradeoffs
- Shows a light neighborhood map for contextual impact

## API surface

- `GET /api/scenarios/default`
- `GET /api/graph`
- `GET /api/neighborhoods`
- `POST /api/simulate-policy`
- `POST /api/recommend-interventions`
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
├── frontend
│   ├── nginx
│   │   └── default.conf.template
│   ├── src
│   │   ├── app
│   │   │   ├── app.css
│   │   │   ├── app.html
│   │   │   ├── app.spec.ts
│   │   │   ├── app.ts
│   │   │   ├── policy-navigator.service.ts
│   │   │   └── policy-navigator.types.ts
│   │   ├── index.html
│   │   ├── main.ts
│   │   └── styles.css
│   ├── Dockerfile
│   ├── angular.json
│   └── package.json
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
- API docs: [http://localhost:8000/docs](http://localhost:8000/docs)
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

1. Open the dashboard.
2. Pick a housing policy and priority.
3. Run the simulation.
4. Inspect which loops stay dangerous.
5. Review the suggested interventions and tradeoffs.

## Notes

- The simulation is deterministic and explainable by design.
- The advisor layer is grounded on structured policy logic so the demo still works even if generative AI is unavailable.
- `understand.md` contains the product brief, technical concept note, and B2G pitch framing.
