# Angular + FastAPI + PostgreSQL Boilerplate

This repository is a production-oriented connection-test starter that verifies end-to-end communication across:

- Angular frontend
- FastAPI backend
- PostgreSQL database

The backend seeds a `system_status` table on startup with `Hello from the PostgreSQL Database!`. The Angular app calls `/api/status` through Nginx and renders the database message in the browser.

## Project structure

```text
.
├── backend
│   ├── app
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── main.py
│   │   └── schemas.py
│   ├── Dockerfile
│   └── requirements.txt
├── frontend
│   ├── nginx
│   │   └── default.conf.template
│   ├── public
│   ├── src
│   │   ├── app
│   │   │   ├── app.config.ts
│   │   │   ├── app.css
│   │   │   ├── app.html
│   │   │   ├── app.routes.ts
│   │   │   ├── app.spec.ts
│   │   │   ├── app.ts
│   │   │   └── status.service.ts
│   │   ├── index.html
│   │   ├── main.ts
│   │   └── styles.css
│   ├── Dockerfile
│   ├── angular.json
│   └── package.json
├── .dockerignore
├── .env
├── .env.example
├── docker-compose.yml
└── README.md
```

## Run with Docker Compose

1. Copy the environment template if you want to customize values:

   ```bash
   cp .env.example .env
   ```

2. Build and start the full stack:

   ```bash
   docker compose up --build
   ```

3. Open the services:

   - Frontend: http://localhost:4200
   - Backend: http://localhost:8000/api/status
   - Backend health check: http://localhost:8000/healthz

## Useful commands

```bash
docker compose up --build -d
docker compose logs -f
docker compose down
docker compose down -v
```
