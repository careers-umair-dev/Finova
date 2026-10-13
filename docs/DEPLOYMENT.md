# Deploying Finova

Recommended topology: **web on Vercel**, **API in a container** (Render, Fly.io, Railway, or any Docker host), **MongoDB Atlas**, optional **S3-compatible bucket** for documents.

## 1. MongoDB Atlas
1. Create a cluster (a free M0 works; Atlas clusters are replica sets, which the ledger's transactions require).
2. Create a database user with read/write on the `finova` database only. Allow the API host's egress IPs in Network Access.
3. Use the `mongodb+srv://…/finova?retryWrites=true&w=majority` string as `MONGODB_URI`. Enable backups.

## 2. API (container)
Build from the repo root: `docker build -f apps/api/Dockerfile -t finova-api .` (non-root user, health check on `/health`).

| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV` | yes | `production` (enables Secure cookies) |
| `PORT` | no | default 4000 |
| `MONGODB_URI` | yes | Atlas string |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | yes | ≥32 chars, different from each other. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `CLIENT_URL` | yes | exact origin of the web app, e.g. `https://finova.example.com` (used for CORS and email links) |
| `COOKIE_SAMESITE` | no | `lax` (default) for same-site setups; `none` for cross-site (see §4) |
| `TRUST_PROXY` | yes behind a proxy | number of proxy hops in front of the API. Needed so rate limiting sees client IPs, not the proxy's. Verify in logs. |
| `SMTP_HOST/PORT/USER/PASS`, `EMAIL_FROM` | for email | without SMTP, password-reset and verification emails are **not sent** |
| `STORAGE_DRIVER` | no | `local` (default) or `s3` |
| `UPLOAD_DIR` | local only | must be a **persistent volume** in production |
| `OBJECT_STORAGE_BUCKET/REGION/ENDPOINT/ACCESS_KEY_ID/SECRET_ACCESS_KEY` | s3 only | `ENDPOINT` for R2/MinIO. Keep the bucket private with encryption on. |

Platform settings: health check path `/health/ready` (200 only when MongoDB is connected), graceful shutdown is handled on SIGTERM. Run **one** instance until you've reviewed rate-limit storage (limits are in-memory per instance).

Do **not** run `npm run seed` in production (it refuses). Create real users through the app.

## 3. Web (Vercel)
1. Import the repo; set **Root Directory** to `apps/web` and enable "Include source files outside of the Root Directory".
2. Edit `apps/web/vercel.json`: replace `YOUR-API-HOST.example.com` in the `/api` rewrite with your API's host.
3. Deploy. No environment variables are needed for the same-site setup.

## 4. Cookies, CORS and the two supported setups
| | A. Same-site (recommended) | B. Cross-site |
|---|---|---|
| How | Vercel rewrites `/api/*` to the API, so the browser only talks to one origin | Browser calls the API origin directly |
| API | `COOKIE_SAMESITE=lax`, `CLIENT_URL=<web origin>` | `COOKIE_SAMESITE=none` (forces Secure), `CLIENT_URL=<web origin>` |
| Web | nothing | `VITE_API_BASE_URL=https://api.example.com`; widen `connect-src` in the CSP in `vercel.json` |
| CSRF | custom-header guard (always on) | same; third-party-cookie blocking in some browsers can break setup B |

Uploads are capped at 5 MB. If a host or rewrite layer enforces a smaller request-body limit, uploads will fail with 413. Check this on your platform.

## 5. Release checklist
- [ ] `npm run check` and `npm run e2e` pass on CI
- [ ] Secrets set only in the host's secret store; `.env` files not committed
- [ ] `NODE_ENV=production`, HTTPS only, `CLIENT_URL` exact
- [ ] Atlas backups on; DB user least-privilege; IP allowlist set
- [ ] `STORAGE_DRIVER=s3` (or a persistent volume for `UPLOAD_DIR`)
- [ ] SMTP configured and password reset tested end to end
- [ ] `TRUST_PROXY` verified (log a request, confirm `req.ip` is the client)
- [ ] Open the app with the browser console visible: no CSP violations
- [ ] `npm audit` reviewed
