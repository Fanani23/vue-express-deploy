#!/usr/bin/env bash
# Runs every e2e script against a running stack. Environment:
#   E2E_BASE         portal URL            (default http://127.0.0.1:8080)
#   E2E_TASKPULSE    TaskPulse URL         (default http://127.0.0.1:8088)
#   E2E_API          express API URL       (default: the portal origin; http://127.0.0.1:3000 for the local dev server)
#   E2E_USER / E2E_PASSWORD / E2E_CODE     (default admin@techtest.dev / Techtest123! / 111111)
#   One UI sign-in per run: the first script caches the session for the others (session.mjs, which revokes it, runs last).
#   E2E_BROWSER_URL  connect to a running Chrome (http://127.0.0.1:9333) instead of launching one
#   E2E_CHROME       Chrome/Chromium executable to launch (default: first of google-chrome, chromium, chromium-browser)
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
[[ -d node_modules ]] || npm i --no-audit --no-fund --loglevel=error
failed=0
# The first script signs in through the UI and caches the session for the others (lib.mjs); session.mjs goes last
# because it revokes the session on purpose. A run starts from a clean cache.
rm -rf "${TMPDIR:-/tmp}/vt-e2e"
# lockout.mjs first: its seven sign-in calls plus the rest of the run stay under the 10/min per-address limit
for t in "${@:-tests/lockout.mjs tests/pages.mjs tests/dashboard.mjs tests/taskfields.mjs tests/csv.mjs tests/webhooks.mjs tests/history.mjs tests/idempotency.mjs tests/live.mjs tests/a11y.mjs tests/devices.mjs tests/session.mjs}"; do
  for f in $t; do
    printf '\n\033[1;34m==> %s\033[0m\n' "$f"
    node "$f" || failed=1
  done
done
[[ $failed -eq 0 ]] && printf '\n\033[1;32mALL E2E PASSED\033[0m\n' || { printf '\n\033[1;31mSOME E2E FAILED\033[0m\n'; exit 1; }
