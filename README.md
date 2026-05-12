# AI Job Applications Monorepo

## Apps

- apps/backend: Laravel 12 API
- apps/frontend: React + TypeScript (Vite)
- apps/worker: Python worker service (FastAPI)

## Infrastructure

Start local MySQL and Redis:

```bash
docker compose up -d
```

## Backend setup

```bash
cd apps/backend
cp .env.example .env
php artisan key:generate
php artisan migrate:fresh --seed
php artisan test
php artisan serve
```

Implemented API v1 endpoints:

- GET /api/v1/health
- GET /api/v1/jobs
- GET /api/v1/quotas/today
- PUT /api/v1/quotas/today
- POST /api/v1/application-sessions/start
- GET /api/v1/application-sessions/{id}
- POST /api/v1/application-sessions/{id}/stop

Auth note: current bootstrap mode resolves user by `X-User-Id` header (defaults to 1) for rapid development.

## Frontend setup

```bash
cd apps/frontend
npm install
npm run dev
```

## Worker setup

```bash
cd apps/worker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8001
```

Worker endpoints:

- GET /health
- POST /tasks/enqueue
- GET /tasks/{task_id}
- POST /tasks/{task_id}/mark-running
- POST /tasks/{task_id}/mark-done

## Current status

Implemented in this iteration:

- Monorepo scaffold (Laravel + React + FastAPI)
- Core Phase 1 MySQL schema migrations
- Initial Laravel API controllers and routing
- Backend feature tests for API baseline
- Worker task queue stubs for scrape/tailor/apply orchestration
- Docker Compose for MySQL and Redis
