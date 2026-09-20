#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="${1:?usage: apply.sh <path to express-template checkout>}"
cd "$REPO"
if ! command -v node >/dev/null 2>&1 && [[ -s "$HOME/.nvm/nvm.sh" ]]; then . "$HOME/.nvm/nvm.sh"; fi

apply_diff() {
  if grep -qE "$2" "$3"; then echo "already  $(basename "$1")"
  elif git apply --check "$1" 2>/dev/null; then git apply "$1"; echo "applied  $(basename "$1")"
  else echo "CONFLICT $(basename "$1")" >&2; exit 1; fi
}
apply_diff "$HERE"/0001-keyv-string-keys.diff  "keyv\.set\(String\(id\)"  common/compiled/node/auth/keyv.js
apply_diff "$HERE"/0002-otp-await-verify.diff  "await verify\("               common/compiled/node/express/controller/auth/own.js

cp "$HERE/mailer.js" common/compiled/node/services/mailer.js
if grep -q "consumeOtpCode" common/compiled/node/auth/keyv.js; then echo "already  0003-email-otp-and-oauth-env.js"
else node "$HERE/0003-email-otp-and-oauth-env.js" "$REPO" && echo "applied  0003-email-otp-and-oauth-env.js"; fi
node "$HERE/0005-signup.js" "$REPO"
node "$HERE/0007-auth-providers.js" "$REPO"
cp "$HERE/google.js" common/compiled/node/express/controller/auth/google.js
node "$HERE/0008-google-signin.js" "$REPO"
node "$HERE/0009-fixed-otp-pin.js" "$REPO"
node "$HERE/0010-refresh-from-body.js" "$REPO"
node "$HERE/0011-jwt-user-meta-claim.js" "$REPO"
node "$HERE/0012-auth-rate-limit.js" "$REPO"
node "$HERE/0013-keyv-redis.js" "$REPO"
node "$HERE/0014-httponly-refresh.js" "$REPO"
node "$HERE/0015-refresh-rotation-reuse.js" "$REPO"
node "$HERE/0016-users-endpoint.js" "$REPO"
node "$HERE/0019-account-lockout.js" "$REPO"
echo "patches done (run 'npm i' at the repo root to install nodemailer)"
