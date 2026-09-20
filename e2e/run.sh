#!/usr/bin/env bash
# Runs every e2e script against a running stack. Environment:
#   E2E_BASE         portal URL            (default http://127.0.0.1:8080)
#   E2E_TASKPULSE    TaskPulse URL         (default http://127.0.0.1:8088)
#   E2E_USER / E2E_PASSWORD / E2E_CODE     (default admin@techtest.dev / Techtest123! / 111111)
#   E2E_BROWSER_URL  connect to a running Chrome (http://127.0.0.1:9333) instead of launching one
#   E2E_CHROME       Chrome/Chromium executable to launch (default: first of google-chrome, chromium, chromium-browser)
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
[[ -d node_modules ]] || npm i --no-audit --no-fund --loglevel=error
failed=0
for t in "${@:-tests/pages.mjs tests/session.mjs tests/dashboard.mjs tests/live.mjs tests/a11y.mjs}"; do
  for f in $t; do
    printf '\n\033[1;34m==> %s\033[0m\n' "$f"
    node "$f" || failed=1
  done
done
[[ $failed -eq 0 ]] && printf '\n\033[1;32mALL E2E PASSED\033[0m\n' || { printf '\n\033[1;31mSOME E2E FAILED\033[0m\n'; exit 1; }
