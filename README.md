# Finova

A financial analytics web app: **React + Vite + Tailwind** frontend (`apps/web`) and **Express + MongoDB** API (`apps/api`).

> Finova is an **internal ledger**. It does not connect to banks, issue cards or credit, or move real money. "Send" and "Receive" record entries in your own ledger.

## Quick start
```bash
docker compose up -d                     # local MongoDB replica set (transactions need one); or use Atlas
npm install                              # both workspaces; commit the generated package-lock.json
cp apps/api/.env.example apps/api/.env   # fill in MONGODB_URI and both JWT secrets (command is in the file)
npm run seed                             # optional: demo data. Prints a random demo password (dev only)
npm run dev:api                          # http://localhost:4000   OpenAPI: /openapi.yaml   Health: /health, /health/ready
npm run dev:web                          # http://localhost:5173   (proxies /api to :4000)
```
In `apps/api/.env`: `MONGODB_URI=mongodb://localhost:27017/finova?replicaSet=rs0`, `CLIENT_URL=http://localhost:5173`, `COOKIE_SAMESITE=lax`.

## Scripts (repo root)
| Command | What it does |
|---|---|
| `npm run lint` | ESLint (TypeScript, React hooks) |
| `npm run typecheck` | `tsc --noEmit` in both apps |
| `npm test` | Vitest: API (Supertest, in-memory MongoDB replica set) and web (React Testing Library) |
| `npm run build` | API → `apps/api/dist`, web → `apps/web/dist` |
| `npm run e2e:install` then `npm run e2e` | Playwright end-to-end tests (starts MongoDB + API + web itself) |
| `npm run check` | lint + typecheck + tests + build |
| `npm run seed` | Demo data for local development (refuses to run in production) |

## Layout
```
apps/api   Express + Mongoose. routes → services → models; middleware for auth, CSRF, validation, errors
apps/web   React app: pages, dialogs, dashboard cards, TanStack Query hooks, API client
e2e        Playwright specs + stack launcher
docs       DEPLOYMENT.md, ACCEPTANCE.md
```

## Configuration
Every variable is documented in `apps/api/.env.example` and `apps/web/.env.example`; the API validates its environment at boot and exits naming any bad variable (never printing values). Secrets never go in the frontend bundle: the web app has no secrets, and `VITE_API_BASE_URL` is optional.

## Security model (short)
httpOnly cookie sessions (15-min access JWT + rotating refresh token, reuse detection, server-side revocation) · bcrypt · login/register rate limits · strict zod validation on every route · `$`-operator/NoSQL guard · custom-header CSRF guard · ownership-scoped queries (other users' records return 404) · integer minor-unit money · transactional ledger writes with overdraft protection and idempotency keys · append-only activity log · magic-byte checked uploads served with a sandbox CSP.

## Documentation
- **Deploying:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- **What is and isn't verified:** [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md). Read this before trusting the build.

<div align="center">

Built with ❤️ by Umair Ansari

</div>
