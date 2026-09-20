#!/usr/bin/env bash
set -euo pipefail
#
# Optional environment: WEB_ORIGIN (public origin of the Vue app, for TaskPulse CORS) and
# TASKPULSE_URL (public base URL of TaskPulse, baked into the Vue build). Both default to http://<public ip>[:8088].
# USE_OTP (EMAIL|GA|TEST, default EMAIL).

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VT_USER=vt
VT_HOME=/opt/vt
NODE_MAJOR=24
export DEBIAN_FRONTEND=noninteractive DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
as_vt() { sudo -u "$VT_USER" -H env PATH="$PATH" DOTNET_CLI_TELEMETRY_OPTOUT=1 "$@"; }

[[ $EUID -eq 0 ]] || { echo "run as root: sudo bash $0" >&2; exit 1; }
PUBLIC_IP="$(curl -fs -m 3 http://checkip.amazonaws.com 2>/dev/null || hostname -I | awk '{print $1}')"
WEB_ORIGIN="${WEB_ORIGIN:-http://$PUBLIC_IP}"
TASKPULSE_URL="${TASKPULSE_URL:-http://$PUBLIC_IP:8088}"
[[ -d "$ROOT/taskpulse" ]] || { echo "expected $ROOT/taskpulse (run from the extracted submission)" >&2; exit 1; }
. /etc/os-release
log "Ubuntu $VERSION_ID on $(uname -m), $(free -m | awk '/Mem:/{print $2}') MB RAM"

if [[ $(free -m | awk '/Mem:/{print $2}') -lt 1800 && ! -f /swapfile ]]; then
  log "Adding 2 GB swap (small instance)"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

log "Base packages, nginx, PostgreSQL"
apt-get update -q
apt-get install -y -q ca-certificates curl git build-essential unzip jq nginx postgresql postgresql-client ufw

if [[ "$(pg_lsclusters -h | awk 'NR==1{print $3}')" == "5432" ]]; then
  log "PostgreSQL: moving cluster to port 5433 (5432 belongs to the template's PGlite)"
  PG_VER="$(pg_lsclusters -h | awk 'NR==1{print $1}')"; PG_CL="$(pg_lsclusters -h | awk 'NR==1{print $2}')"
  pg_conftool "$PG_VER" "$PG_CL" set port 5433
  pg_ctlcluster "$PG_VER" "$PG_CL" restart
fi
for i in $(seq 1 20); do pg_lsclusters -h | awk 'NR==1{print $4}' | grep -q online && break; sleep 0.5; done
pg_lsclusters | sed 's/^/  /'
[[ "$(pg_lsclusters -h | awk 'NR==1{print $4}')" == "online" ]] || { echo "PostgreSQL cluster is not online" >&2; tail -20 /var/log/postgresql/*.log; exit 1; }

log "Node.js $NODE_MAJOR"
if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1)" != "v$NODE_MAJOR" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null
  apt-get install -y -q nodejs
fi
node -v; npm -v

log ".NET SDK 10"
if ! dotnet --list-sdks 2>/dev/null | grep -q '^10\.'; then
  if ! apt-get install -y -q dotnet-sdk-10.0 2>/dev/null; then
    curl -fsSL "https://packages.microsoft.com/config/ubuntu/${VERSION_ID}/packages-microsoft-prod.deb" -o /tmp/msprod.deb
    dpkg -i /tmp/msprod.deb >/dev/null && apt-get update -q && apt-get install -y -q dotnet-sdk-10.0
  fi
fi
dotnet --version

log "Vue+Express: user and clones"
id -u "$VT_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir "$VT_HOME" --shell /usr/sbin/nologin "$VT_USER"
chmod 755 "$VT_HOME"
cd "$VT_HOME"
[[ -d express-template  ]] || as_vt git clone -q https://github.com/es-labs/express-template.git
[[ -d vue-antd-template ]] || as_vt git clone -q https://github.com/es-labs/vue-antd-template.git

log "Vue+Express: npm install (backend workspace, dbdeploy, frontend)"
( cd express-template            && as_vt npm i --no-audit --no-fund --loglevel=error )
( cd express-template/scripts/dbdeploy && as_vt npm i --no-audit --no-fund --loglevel=error )
( cd vue-antd-template           && as_vt npm i --no-audit --no-fund --loglevel=error )
( cd vue-antd-template/apps      && as_vt npm i --no-audit --no-fund --loglevel=error )

log "Vue+Express: template patches (findings 4-5 in docs/vue-express-notes.md, EMAIL OTP, OAuth secrets from env)"
as_vt bash "$ROOT/vue-express-deploy/patches/apply.sh" "$VT_HOME/express-template" | sed 's/^/  /'
( cd "$VT_HOME/express-template" && as_vt npm i --no-audit --no-fund --loglevel=error )

log "Vue+Express: database (PGlite) - api_role, migrations, seeds in dependency order"
systemctl stop vt-api vt-db 2>/dev/null || true
cd "$VT_HOME/express-template/scripts/dbdeploy"
as_vt node --input-type=module -e "
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite('./db-sample/dev.db');
await db.exec(\`DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='api_role') THEN CREATE ROLE api_role; END IF; END \$\$\`);
await db.close();"
install -o "$VT_USER" -m 0644 "$ROOT"/vue-express-deploy/migrations/*.js db-sample/migrations/
as_vt npx knex --knexfile db-sample/knexfile.js migrate:latest 2>&1 | grep -E "Batch|Already up to date|migrations" || true
if [[ "$(as_vt node --input-type=module -e "import {PGlite} from '@electric-sql/pglite';const db=new PGlite('./db-sample/dev.db');const r=await db.query('select count(*)::int n from users');console.log(r.rows[0].n);await db.close();")" == "0" ]]; then
  for s in initial_users.js initial_rbac.js initial_testdata.js; do as_vt npx knex --knexfile db-sample/knexfile.js seed:run --specific=$s 2>&1 | grep -E "Ran|RBAC" || true; done
else
  echo "  already seeded"
fi
install -o "$VT_USER" -m 0644 "$ROOT/vue-express-deploy/patches/seed-demo-accounts.mjs" ./seed-demo-accounts.mjs
as_vt node ./seed-demo-accounts.mjs

log "Vue+Express: apply the web-techtest overlay (custom app, per the template README)"
as_vt bash "$ROOT/vue-express-deploy/web-techtest/apply.sh" "$VT_HOME/vue-antd-template" | sed 's/^/  /'

log "Vue+Express: frontend production build (same-origin: empty VITE_API_URL -> relative /api calls)"
cd "$VT_HOME/vue-antd-template/apps"
cat > web-techtest/envs/.env.cloud <<'EOF'
VITE_SENTRY_DSN=
VITE_API_URL=
VITE_WITH_CREDENTIALS=same-origin
VITE_WS_URL=
VITE_WS_MS=5000
BASE_PATH=/
VITE_REFRESH_URL=/api/auth/refresh
VITE_LOGOUT_URL=/api/auth/logout
EOF
echo "VITE_TASKPULSE_URL=$TASKPULSE_URL" >> web-techtest/envs/.env.cloud
chown "$VT_USER" web-techtest/envs/.env.cloud
as_vt npx vite build --config web-techtest/vite.config.js --mode cloud --logLevel error
DIST="$VT_HOME/vue-antd-template/apps/web-techtest/dist"
[[ -f "$DIST/index.html" ]] && echo "  built: $DIST" || { echo "frontend build failed" >&2; exit 1; }

log "Vue+Express: systemd units vt-db, vt-api"
cat > /etc/systemd/system/vt-db.service <<EOF
[Unit]
Description=Vue+Express - PGlite socket DB for express-template (127.0.0.1:5432)
After=network.target
[Service]
Type=simple
User=$VT_USER
WorkingDirectory=$VT_HOME/express-template/scripts/dbdeploy
ExecStart=/usr/bin/node serve-db.js
Restart=on-failure
RestartSec=2
[Install]
WantedBy=multi-user.target
EOF
cat > /etc/systemd/system/vt-api.service <<EOF
[Unit]
Description=Vue+Express - express-template sample-api (127.0.0.1:3000)
After=network.target vt-db.service
Requires=vt-db.service
[Service]
Type=simple
User=$VT_USER
WorkingDirectory=$VT_HOME/express-template/apps/sample-api
Environment=NODE_ENV=development
Environment=npm_package_name=@express-template/sample-api
Environment=npm_package_version=0.0.6
EnvironmentFile=-/etc/vt/api.env
ExecStartPre=/bin/sleep 1
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=2
[Install]
WantedBy=multi-user.target
EOF
install -d -m 0755 /etc/vt
if [[ ! -f /etc/vt/api.env ]]; then
  cat > /etc/vt/api.env <<'EOF'
SMTP_HOST=
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK=
EOF
  chmod 0600 /etc/vt/api.env
fi
sed -i "s/^USE_OTP=.*/USE_OTP=${USE_OTP:-EMAIL} # EMAIL (code by mail), GA (authenticator app), TEST (111111)/" "$VT_HOME/express-template/apps/sample-api/.env"
systemctl daemon-reload
systemctl enable --now vt-db vt-api >/dev/null
systemctl restart vt-db vt-api

log "Vue+Express: nginx on :80 (SPA + /api -> 3000)"
cat > /etc/nginx/sites-available/vue-express.conf <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    root $DIST;
    index index.html;

    location /api/ {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
    }
    # Hashed build output: cache forever, and a chunk that no longer exists is a 404 - never the SPA's HTML
    # (an HTML body for a <script type=module> is the "expected a JavaScript module" error after a redeploy).
    location /assets/ {
        try_files \$uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
    # The HTML must always be revalidated, otherwise a browser keeps referencing chunks from the previous build.
    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache";
    }
}
EOF
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/vue-express.conf /etc/nginx/sites-enabled/vue-express.conf

log "TaskPulse: scripts/install.sh (PostgreSQL roles, publish, hardened units, nginx :8088)"
chmod +x "$ROOT/taskpulse/scripts/"*.sh
if ! SUDO_USER="${SUDO_USER:-root}" TASKPULSE_ALLOWED_ORIGINS="$WEB_ORIGIN" bash "$ROOT/taskpulse/scripts/install.sh"; then
  echo "TaskPulse install.sh failed - see output above" >&2; exit 1
fi
log "TaskPulse: sample tasks through the API (scripts/seed.sh, skipped when the table is not empty)"
bash "$ROOT/taskpulse/scripts/seed.sh" http://127.0.0.1:8088 | sed 's/^/  /'

log "Firewall: 22, 80, 8088"
if grep -qi microsoft /proc/version; then
  echo "  WSL detected - ufw would block nginx's loopback upstreams here; skipping (a real VM is fine)"
elif ufw allow 22/tcp >/dev/null 2>&1 && ufw allow 80/tcp >/dev/null 2>&1 && ufw allow 8088/tcp >/dev/null 2>&1 && ufw --force enable >/dev/null 2>&1; then
  ufw status | grep -E "^(Status|22|80|8088)" | sed "s/^/  /"
else
  echo "  ufw not usable here (container/WSL?) - rely on the cloud security group"
fi

nginx -t && systemctl reload nginx
sleep 3
log "Verification"
for chk in "http://127.0.0.1/api/healthcheck|Vue+Express API" "http://127.0.0.1/|Vue+Express web" "http://127.0.0.1:8088/health/ready|TaskPulse API" "http://127.0.0.1:8088/|TaskPulse WS"; do
  url="${chk%%|*}"; label="${chk##*|}"
  printf '  %-14s %-40s %s\n' "$label" "$url" "$(curl -s -m 5 -o /dev/null -w '%{http_code}' "$url")"
done
for s in vt-db vt-api postgresql taskpulse-api taskpulse-realtime nginx; do printf '  %-22s %s\n' "$s" "$(systemctl is-active "$s")"; done
login="$(curl -s -m 5 -X POST http://127.0.0.1/api/auth/login -H 'Content-Type: application/json' -d '{"email":"test","password":"test"}')"
if [[ "$login" == *'"otp"'* ]]; then
  echo "  login test/test        $login  (OK - OTP step next)"
else
  echo "  login test/test        FAILED: '$login'"; journalctl -u vt-api -n 5 --no-pager -o cat | cut -c1-160; exit 1
fi
printf '  %-22s %s\n' "postgres port" "$(pg_lsclusters -h | awk 'NR==1{print $3}')  (5432 stays with the template's PGlite)"

log "Done"
echo "  Vue+Express   http://$PUBLIC_IP/          seeded accounts test / ais-one / aaronjxz, password test, code 111111; sign-ups get their code by email (SMTP_* in /etc/vt/api.env)"
echo "  TaskPulse     http://$PUBLIC_IP:8088/     REST: /api/tasks  health: /health/ready  WebSocket console: /"
echo "  Remember to open ports 80 and 8088 in the cloud provider's firewall / security group."
