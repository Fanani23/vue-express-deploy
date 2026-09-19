# vue-express-deploy

Part 1 of the technical test: the es-labs **Vue + Express** templates, fixed and extended, with the custom
frontend app and the scripts that put the stack on a Linux host behind nginx.

Both templates are checked in here as code, taken from the commits validated in the setup notes and modified
in place:

| Folder | Upstream | What changed |
|---|---|---|
| `express-template/` | `es-labs/express-template` @ `db883cd` (MIT) | see **Backend changes** |
| `vue-antd-template/` | `es-labs/vue-antd-template` @ `99a34fa` | `apps/web-techtest/`, the custom app — a copy of `web-sample` with the sign-in / sign-up views, theme and styles replaced, registered in `apps/package.json`; `web-sample` itself is untouched, the customisation route their README prescribes |

Upstream housekeeping (CI workflows, release tooling, changelogs, the unused `sample-mcp` app) is not carried.

| Path | What it does |
|---|---|
| `express-template/` | backend: Express API (`apps/sample-api`), shared auth/db code (`common/`), PGlite migrations and seeds (`scripts/dbdeploy`) |
| `vue-antd-template/` | frontend: Vite + Vue 3 + Ant Design workspace; the deployed app is `apps/web-techtest` |
| `systemd/` | `vt-db` (PGlite server), `vt-api` (Express), `vt-fe` (Vite) units for running the stack as services on a dev box |
| `cloud/bootstrap.sh` | one-shot install of **both** technical-test parts on a fresh Ubuntu VM behind nginx — expects to live in `<submission>/code/vue-express-deploy/cloud` next to `code/taskpulse` |

## Backend changes

All in `express-template/`, each a small, self-contained edit:

| Where | Change |
|---|---|
| `common/compiled/node/auth/keyv.js` | `keyv@5` requires string keys: the refresh-token store is keyed by `String(id)`; EMAIL one-time codes stored with a TTL and an attempt limit |
| `.../controller/auth/own.js` | **security fix** — `otplib` v13 made `verify()` async and the template never awaited it, so any authenticator code was accepted; EMAIL one-time codes; `POST /api/auth/signup`; fixed per-account second factor (`users.otp_pin`) |
| `common/compiled/node/services/mailer.js` | nodemailer transport from `SMTP_*`; console transport (codes to the log) when unset |
| `.../controller/auth/oauth.js`, `google.js` | GitHub sign-in links by verified email or provisions; Continue with Google (OIDC); OAuth secrets from the environment |
| `common/compiled/node/auth/knex.js` | `createUser`: every new account (sign-up, GitHub, Google) is created as `Viewer` — comma column and RBAC rows, role and permissions created on first use; serial sequences synced after the explicit-id seeds |
| `apps/sample-api/src/routes/auth.js`, `routes/index.js` | `/signup`, `/providers`, `/auth` (GitHub redirect alias), Google routes |
| `scripts/dbdeploy/db-sample/migrations/20260919000000_users_otp_pin.js` | `users.otp_pin`: when set on an account, that pin is its second factor instead of an emailed / authenticator code; accounts without it, including every sign-up, get the real code |

## Configuration

The API reads secrets from the environment only (`systemd/vt-api.service` loads a root-only
`EnvironmentFile`, `/etc/vt/api.env`; `cloud/bootstrap.sh` writes the same file on the VM). Nothing secret
is committed.

| Variable | Purpose |
|---|---|
| `USE_OTP` | `EMAIL` (one-time code by mail), `GA` (authenticator), `TEST` (fixed `111111`) |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `SMTP_FROM` | mailer for `USE_OTP=EMAIL`; unset → codes are printed to the log |
| `OAUTH_CLIENT_ID` `OAUTH_CLIENT_SECRET` `OAUTH_CALLBACK` | GitHub OAuth App; the SPA route that receives tokens is `<site>/auth` |
| `GOOGLE_CLIENT_ID` `GOOGLE_CLIENT_SECRET` `GOOGLE_CALLBACK` | Google OAuth client; callback is `<api>/api/google/callback` |

Sign-in buttons for GitHub / Google are shown only when the matching pair is configured
(`GET /api/auth/providers`).

## Run locally

```bash
cd express-template && npm i && (cd scripts/dbdeploy && npm i)
cd scripts/dbdeploy && npx knex --knexfile db-sample/knexfile.js migrate:latest
for s in initial_users.js initial_rbac.js initial_testdata.js; do npx knex --knexfile db-sample/knexfile.js seed:run --specific=$s; done
node serve-db.js &                                  # PGlite on 127.0.0.1:5432
(cd ../../apps/sample-api && npm run dev) &          # API on :3000

cd vue-antd-template && npm i && cd apps && npm i && npm run techtest   # Vite dev server
```

`docs/vue-express-notes.md` in the submission has the full walkthrough, including the `api_role` the
migrations assume and the seed order.

## Why the template needed fixing

See `docs/vue-express-notes.md` in the submission: stale migration README, a Postgres role the migration
assumes, alphabetical seed ordering, `keyv@5` requiring string keys, and an un-awaited async OTP verify that
accepted any code.
