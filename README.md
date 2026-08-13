# fleet-nestjs-app

A **NestJS (TypeScript) + TypeORM** application scaffolded on the fleet lifecycle
harness. It ships one complete sample CRUD resource (`items`), a DB-backed health
check, and Postgres migrations, all wired so the fleet can deploy it unchanged.

## The App

- **Stack:** NestJS 10, TypeORM 0.3 over Postgres (`pg`), `class-validator` DTOs.
- **Config:** the database connection is read from `DATABASE_URL` (injected by the
  fleet; never hardcoded). `PORT` and `BASE_PATH` are read at boot — the server
  listens on `0.0.0.0:$PORT`, and when `BASE_PATH` is set every route is prefixed
  with it **except** `GET /health`.
- **Schema:** `synchronize` is off everywhere. All schema changes go through
  migrations (`src/migrations/`), run automatically on start.

### Endpoints

| Method | Path          | Success | Notes                                   |
| ------ | ------------- | ------- | --------------------------------------- |
| GET    | `/health`     | 200     | Terminus check with a live DB ping      |
| POST   | `/items`      | 201     | Body `{ name, description? }`           |
| GET    | `/items`      | 200     | Newest first                            |
| GET    | `/items/:id`  | 200     | 404 if missing, 400 if `id` isn't a UUID |
| PATCH  | `/items/:id`  | 200     | Partial update; 404 if missing          |
| DELETE | `/items/:id`  | 204     | 404 if missing                          |

Invalid or unknown-field bodies are rejected with 400 by the global
`ValidationPipe`. An `item` is `{ id, name, description, createdAt }` where
`createdAt` is an ISO timestamp.

### Running it

```sh
# Standalone (needs a reachable Postgres in DATABASE_URL):
export DATABASE_URL='postgres://user:pass@host:5432/db'
PORT=3001 bin/run          # npm ci -> build -> migrate -> serve on :3001
curl http://localhost:3001/health   # -> 200

# Under the fleet: it injects PORT / BASE_PATH / DATABASE_URL and calls bin/run.
```

Local development uses the usual Nest scripts: `npm run start:dev` (watch mode),
`npm run build`, `npm run lint`, `npm run typecheck`. The lifecycle commands the
fleet uses live in `fleet.conf`.

### Adding a migration

Schema changes are migration-only. After editing an entity:

```sh
# 1. Build so the compiled datasource/entities exist, then diff against the DB:
npm run build
npm run migration:generate -- src/migrations/<Name>
# (or hand-write one:  npm run migration:create -- src/migrations/<Name>)

# 2. Apply it. This is what START_CMD runs on every deploy, so a fresh DB
#    catches up automatically:
npm run migration:run
```

`migration:run` uses the **compiled** datasource (`dist/database/data-source.js`),
so run `npm run build` first when applying locally. `migration:generate` runs the
TypeScript datasource directly via ts-node.

---

# fleet-template-v1

## What This Template Is

`fleet-template-v1` is a **language-agnostic app lifecycle harness** for apps
managed by the fleet platform. It gives any app — Node, Python, Go, a Docker
Compose stack, anything — a uniform way to be deployed and controlled, without
the fleet needing to know a single thing about your stack.

The fleet injects runtime variables into the environment (`PORT`, `BASE_PATH`,
`DATABASE_URL`) and calls `./bin/run` to deploy. Everything project-specific —
how to install, build, and start your app — lives in **one file: `fleet.conf`**.
That is the only file you edit per project.

## Repository Structure

```
fleet.conf        ← the only file you edit per project
.env              ← local-only env vars (gitignored)
bin/
  _common.sh      ← shared logic; never edit this
  run             ← install + build + start (called by the fleet)
  start           ← start only (no rebuild)
  restart         ← stop + full run
  reload          ← hot-reload config without rebuild
  stop            ← stop the running process
```

## The One File You Edit: `fleet.conf`

`fleet.conf` is sourced as shell by the lifecycle scripts. Fill in the commands
for your stack; leave any command empty (`''`) to skip that step.

```sh
NAME="my-app"           # label shown in fleet logs
PORT="3000"             # default port (fleet overrides via $PORT env var)
HEALTH_PATH="/"         # HTTP path that returns 200 when the app is ready

INSTALL_CMD='npm ci'
BUILD_CMD='npm run build'
START_CMD='node dist/server.js'   # must listen on $PORT; run in foreground
RELOAD_CMD=''           # optional; empty → falls back to stop+start
```

> **Critical rule:** single-quote any command that uses `$PORT` or
> `$BASE_PATH`. Single quotes defer variable expansion to **runtime** — when the
> command actually runs, with the fleet-injected value — rather than at the
> moment `fleet.conf` is sourced (when those values aren't set yet). Use
> `START_CMD='gunicorn app:app --bind 0.0.0.0:$PORT'`, never double quotes.

## How the Lifecycle Works

| Script | What it does | When to use |
| --- | --- | --- |
| `bin/run` | `INSTALL_CMD` → `BUILD_CMD` → `START_CMD` | Fleet deploy, fresh start |
| `bin/start` | `START_CMD` only | Restart without rebuild |
| `bin/restart` | stop + `bin/run` | After a code/dep change |
| `bin/reload` | `RELOAD_CMD`, or stop+start if empty | After a config-only change |
| `bin/stop` | Kill by pidfile or port | Tear down |

> The process PID is written to `.fleet/app.pid` so subsequent `stop`/`restart`
> calls can find and terminate it reliably. If the pidfile is missing or stale,
> `stop` falls back to freeing whatever is listening on `$PORT`.

## How to Apply This to Your Project

### Step 1 — Copy the template into your repo

```sh
cp -r fleet-template-v1/* my-project/
```

Or, if starting fresh, just clone it and work from `main`.

### Step 2 — Edit `fleet.conf` (the only required change)

Fill in your stack's commands. Per-stack examples:

```sh
# Node.js
INSTALL_CMD='npm ci'
BUILD_CMD='npm run build'
START_CMD='node dist/index.js'

# Python (Gunicorn)
INSTALL_CMD='pip install -r requirements.txt'
BUILD_CMD=''
START_CMD='gunicorn app:app --bind 0.0.0.0:$PORT'

# Go
INSTALL_CMD=''
BUILD_CMD='go build -o ./out/server ./cmd/server'
START_CMD='./out/server'

# Docker Compose
INSTALL_CMD=''
BUILD_CMD='docker compose build'
START_CMD='docker compose up'
RELOAD_CMD='docker compose up -d --no-build'
```

### Step 3 — Set local env vars in `.env` (gitignored)

```sh
APP_NAME=My App
DATABASE_URL=postgres://localhost/mydb
```

### Step 4 — Verify standalone

```sh
PORT=3001 bin/run      # should install, build, and serve on 3001
curl http://localhost:3001/   # should 200
```

### Step 5 — Connect to the fleet

Point the fleet at your repo. It will clone it, inject `PORT` / `BASE_PATH` /
`DATABASE_URL`, and call `bin/run`. As long as your `START_CMD` listens on
`$PORT` and `HEALTH_PATH` returns 200, the fleet will mark the app healthy.

## Key Invariants

- **`START_CMD` must run in the foreground and listen on `$PORT`.** Do not use a
  dev server — HMR / hot-reload chunks 404 behind the ingress and will break the
  app.
- **Never put secrets in `fleet.conf`** — it's committed. Use `.env` locally;
  the fleet injects secrets via the environment.
- **`bin/_common.sh` is shared infrastructure** — don't edit it per project. All
  project-specific configuration belongs in `fleet.conf`.
