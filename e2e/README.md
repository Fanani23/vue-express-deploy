# e2e — headless browser checks

Real Chrome driven by puppeteer against a **running** stack (local WSL or the public URLs). Each script signs in,
navigates through the sidebar (the way the router expects), performs create → read → delete flows and prints what it
saw; `a11y.mjs` runs axe-core over every page.

```bash
cd e2e && npm i
E2E_BASE=http://127.0.0.1:8080 E2E_TASKPULSE=http://127.0.0.1:8088 bash run.sh          # local
E2E_BASE=https://202-155-132-250.sslip.io E2E_TASKPULSE=https://taskpulse.202-155-132-250.sslip.io bash run.sh
bash run.sh tests/live.mjs                                                                 # one script
```

Chrome: set `E2E_CHROME=/path/to/chrome` to launch one, or `E2E_BROWSER_URL=http://127.0.0.1:9333` to attach to a
Chrome started with `--remote-debugging-port=9333`. A `[FAIL]` line makes the script exit 1. `webhooks.mjs` points
its hook at the API's own loopback address (`E2E_WEBHOOK_SINK`, default `http://127.0.0.1:5080/api/audit`; in
compose the API listens on `:8080` inside its container).

| Script | Checks |
|---|---|
| `pages.mjs` | every page after sign-in loads with no runtime error, no 4xx/5xx |
| `session.mjs` | refresh keeps the session; refresh token is neither in storage nor readable; 30-min idle signs out; logout clears |
| `dashboard.mjs` | live stats, add/delete a team member and a link (catalog CRUD through the UI) |
| `live.mjs` | a change in one tab updates another tab without reload (WebSocket change events), optimistic delete, audit actor, anonymous write refused |
| `a11y.mjs` | axe-core (WCAG 2.1 A/AA rules) on every page; serious/critical violations fail |
