#!/usr/bin/env bash
set -euo pipefail
OVERLAY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="${1:?usage: apply.sh <path to vue-antd-template checkout>}"
APPS="$REPO/apps"
[[ -d "$APPS/web-sample" ]] || { echo "not a vue-antd-template checkout: $REPO" >&2; exit 1; }

rm -rf "$APPS/web-techtest"
cp -r "$APPS/web-sample" "$APPS/web-techtest"
cp -r "$OVERLAY/app/." "$APPS/web-techtest/"
sed -i "s|root: 'web-sample'|root: 'web-techtest'|" "$APPS/web-techtest/vite.config.js"

if ! command -v node >/dev/null 2>&1 && [[ -s "$HOME/.nvm/nvm.sh" ]]; then . "$HOME/.nvm/nvm.sh"; fi

node "$OVERLAY/register-app.js" "$APPS/package.json"
grep -q '^!web-techtest$' "$APPS/.gitignore" || echo '!web-techtest' >> "$APPS/.gitignore"

node "$OVERLAY/add-signup-route.js" "$APPS/web-techtest/setups/routes.js"

echo "web-techtest ready: $(cd "$OVERLAY/app" && find . -type f | sed 's|^\./||' | tr '\n' ' ')"
