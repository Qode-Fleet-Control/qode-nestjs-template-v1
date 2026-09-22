# fleet-nestjs-app

A **NestJS (TypeScript) + TypeORM** application scaffolded on the fleet lifecycle
harness. It ships one complete sample CRUD resource (`items`), a DB-backed health
check, and Postgres migrations, all wired so the fleet can deploy it unchanged.

## The App

- **Stack:** NestJS 10, TypeORM 0.3 over Postgres (`pg`), `class-validator` DTOs.
- **Config:** the database connection is read from `DATABASE_URL` (injected by the
  fleet; never hardcoded). `PORT` is read at boot — the server listens on
  `0.0.0.0:$PORT`. `BASE_PATH` is the routing prefix every route mounts under —
  see [Routing and `BASE_PATH`](#routing-and-base_path) below.
- **Schema:** `synchronize` is off everywhere. All schema changes go through
  migrations (`src/migrations/`), run automatically on start.
- **Versioning:** URI versioning is enabled (`VersioningType.URI`,
  `defaultVersion: '1'`). Routes resolve as **version → route**, so the `items`
  resource serves under `/v1/...`. `GET /health` opts out with
  `VERSION_NEUTRAL`, so it carries no version segment — but it still mounts under
  the routing prefix (`$BASE_PATH/health`), like every other route.

### Routing and `BASE_PATH`

The fleet serves each app behind an internal proxy keyed on the workspace host and
the app's port. It injects `BASE_PATH=/direct/<hostname>:<port>` — for example
`/direct/dy-coord-9:3000` — as the routing prefix, and forwards the **full path
without stripping it**: a request the fleet routes as
`/direct/dy-coord-9:3000/v1/items` arrives at the app with that whole path intact.

To match, the app calls `setGlobalPrefix(BASE_PATH)` with **no exclusions**, so
**every** route mounts under the prefix — including the health check. With
`BASE_PATH=/direct/dy-coord-9:3000` the routes resolve as:

```
/direct/dy-coord-9:3000/health      → the readiness probe
/direct/dy-coord-9:3000/v1/items    → the items resource
```

`BASE_PATH` is fleet-injected; in a fleet deployment you do **not** set it by hand.
Left empty or unset (as when running standalone), the global prefix is skipped and
routes serve at the host root — `/health`, `/v1/items`. There is no mode where the
health check lives at a bare `/health` while the rest of the app is prefixed: health
always mounts under the same prefix as every other route.

### Endpoints

| Method | Path            | Success | Notes                                   |
| ------ | --------------- | ------- | --------------------------------------- |
| GET    | `/health`       | 200     | Terminus check with a live DB ping; unversioned |
| POST   | `/v1/items`     | 201     | Body `{ name, description? }`           |
| GET    | `/v1/items`     | 200     | Newest first                            |
| GET    | `/v1/items/:id` | 200     | 404 if missing, 400 if `id` isn't a UUID |
| PATCH  | `/v1/items/:id` | 200     | Partial update; 404 if missing          |
| DELETE | `/v1/items/:id` | 204     | 404 if missing                          |

The version segment is required: `GET /items` (no `/v1`) returns 404. Invalid or
unknown-field bodies are rejected with 400 by the global `ValidationPipe`. An
`item` is `{ id, name, description, createdAt }` where `createdAt` is an ISO
timestamp.

#### Enabling / disabling versions (`API_VERSIONS_ENABLED`)

`API_VERSIONS_ENABLED` is a comma-separated list of the API versions the app
serves — `API_VERSIONS_ENABLED='1'` or `API_VERSIONS_ENABLED='1,2'`. **Unset
defaults to `'1'`**, so a stock deploy serves v1 with no configuration.

A global `VersionGate` guard resolves the version of the matched route and, when
that version is not in the enabled set, returns **`410 Gone`** (e.g. `API v2 is
disabled`). This is distinct from a **`404`**, which is what an unknown version
segment (`/v9/...`, a version that never existed) returns from the router. So:

- `410 Gone` — a real, known version that is currently switched off.
- `404 Not Found` — a version segment that was never mounted.

`GET /health` is `VERSION_NEUTRAL` and is **exempt** — it keeps returning `200`
regardless of `API_VERSIONS_ENABLED`, so the readiness probe is never gated.

Flipping it is env-only: change `API_VERSIONS_ENABLED` and **restart/reload the
fleet** (`bin/restart` or `bin/reload`). It takes effect on the next boot with no
rebuild, since runtime deploys here are operator-controlled. For example, setting
`API_VERSIONS_ENABLED='2'` (excluding `'1'`) makes every `/v1/...` route return
`410` while `/health` still returns `200`.

#### Introducing a v2

The version lives on the controller, so a second version is additive — the `/v1`
routes keep working untouched. Either add a controller with
`@Controller({ path: '...', version: '2' })` to serve it at `/v2/...` (or
`@Version('2')` on an individual route method), or add a new versioned module for
the v2 surface. Routes without a version fall back to the `defaultVersion`
(`'1'`); mark any route that must answer on every version with `VERSION_NEUTRAL`,
as `/health` does.

### Running it

```sh
# Standalone (needs a reachable Postgres in DATABASE_URL):
export DATABASE_URL='postgres://user:pass@host:5432/db'
PORT=3001 bin/run          # npm ci -> build -> migrate -> serve on :3001
curl http://localhost:3001/health   # -> 200
curl http://localhost:3001/v1/items # -> 200

# Disable v1 to see the 410 gate (health stays exempt):
API_VERSIONS_ENABLED='2' PORT=3001 bin/run
curl http://localhost:3001/v1/items # -> 410 (API v1 is disabled)
curl http://localhost:3001/health   # -> 200

# Under the fleet: it injects PORT / DATABASE_URL and calls bin/run.
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

The fleet injects runtime variables into the environment (`PORT`,
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

> **Critical rule:** single-quote any command that uses `$PORT`. Single quotes
> defer variable expansion to **runtime** — when the command actually runs, with
> the fleet-injected value — rather than at the moment `fleet.conf` is sourced
> (when it isn't set yet). Use
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

Point the fleet at your repo. It will clone it, inject `PORT` /
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

## Rule: everything under BASE_PATH

The fleet serves this app under `BASE_PATH=/direct/<agent>:<port>` and nginx
forwards that prefix **unchanged** — it is not stripped. So every route, redirect
and asset URL has to carry it.

`src/main.ts` already does the mounting: it normalises `BASE_PATH` and calls
`app.setGlobalPrefix(basePath)`, so controller routes are prefixed for free and
`@Controller({ path: 'health', version: VERSION_NEUTRAL })` resolves at
`<BASE_PATH>/health`. `app.set('trust proxy', 1)` makes `req.protocol` and
`req.ip` reflect the external values behind the proxy.

What is **not** handled for you:

- Any absolute URL you build by hand — a `res.redirect('/x')`, a `Location`
  header, a link or asset path in an HTML response. Prefix it with the same
  normalised `BASE_PATH` value.
- Any client-side `fetch` you add. A framework prefix never rewrites a URL
  string in code.

`HEALTH_PATH` in `fleet.conf` stays **un-prefixed** (`/health`): the fleet
prepends `$BASE_PATH` itself, so an embedded `/direct/…` there is doubled and the
health check never passes.
