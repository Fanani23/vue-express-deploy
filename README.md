# vue-express-deploy

Deployment kit for the es-labs **Vue + Express** templates (part 1 of the technical test): the fixes and
extensions the templates need, the custom frontend app, and the scripts that put the stack on a Linux host
behind nginx.

This repo contains **no code from es-labs**. Both templates are cloned at deploy time and pinned to the
commits validated in the setup notes:

| Template | Commit |
|---|---|
| `es-labs/express-template` | `db883cd` |
| `es-labs/vue-antd-template` | `99a34fa` |

| Path | What it does |
|---|---|
| `patches/` + `patches/apply.sh` | seven patches applied to a checkout of `express-template`, in order: `0001` keyv string keys (login broke on `keyv@5`), `0002` awaited OTP verify (**security fix** — any code was accepted), `0003` EMAIL one-time codes + secrets from the environment, `0005` sign-up (the template ships a TODO stub and a dead `/signup` link), `0007` `GET /api/auth/providers` (the UI shows only what the server can do), `0008` Google sign-in, `0009` per-account default code (`users.otp_pin`: seeded demo accounts sign in with `111111`, every other account gets its code by email). Idempotent, marker-based. |
| `migrations/` | kit migration copied next to the template's before `migrate:latest`: adds `users.otp_pin` |
| `web-techtest/` + `web-techtest/apply.sh` | the custom frontend app, created as a copy of the template's `web-sample` with `web-techtest/app/` laid over it — the customisation route the template README prescribes, so `web-sample` is never edited. Registers `npm run techtest` / `techtest:build` and the missing `/signup` route. |
| `systemd/` | `vt-db` (PGlite server), `vt-api` (Express), `vt-fe` (Vite) units for running the stack as services on a dev box |
| `cloud/bootstrap.sh` | one-shot install of **both** technical-test parts on a fresh Ubuntu VM behind nginx — expects to live in `<submission>/code/vue-express-deploy/cloud` next to `code/taskpulse` |

## Configuration

The API reads secrets from the environment only (`systemd/vt-api.service` loads a root-only
`EnvironmentFile`, `/etc/vt/api.env`; `cloud/bootstrap.sh` writes the same file on the VM). Nothing secret
is committed.

| Variable | Purpose |
|---|---|
| `USE_OTP` | `EMAIL` (one-time code by mail), `GA` (authenticator), `TEST` (fixed `111111`) |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `SMTP_FROM` | mailer for `USE_OTP=EMAIL`; unset → codes are printed to the log |
| `GOOGLE_CLIENT_ID` `GOOGLE_CLIENT_SECRET` `GOOGLE_CALLBACK` | Google OAuth client; callback is `<api>/api/google/callback` |

The **Continue with Google** button is shown only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are both set
(`GET /api/auth/providers` reports it).

Two second factors coexist under `USE_OTP=EMAIL`: the seeded accounts (`test`, `ais-one`, `aaronjxz`, password `test`)
carry `otp_pin = 111111` and always use it; accounts created by sign-up or Google have no pin and receive a real
6-digit code by email — at sign-up (activation) and at every later sign-in.

## Apply to a checkout

```bash
git clone https://github.com/es-labs/express-template && git -C express-template checkout db883cd
git clone https://github.com/es-labs/vue-antd-template && git -C vue-antd-template checkout 99a34fa
bash patches/apply.sh express-template            # then: cd express-template && npm i
bash web-techtest/apply.sh vue-antd-template      # then: cd vue-antd-template/apps && npm run techtest
```

## Why the template needed fixing

See `docs/vue-express-notes.md` in the submission: stale migration README, a Postgres role the migration
assumes, alphabetical seed ordering, `keyv@5` requiring string keys, and an un-awaited async OTP verify that
accepted any code.
