const fs = require("fs"), path = require("path");
const root = process.argv[2];
const f = path.join(root, "common/compiled/node/services/db/keyv.js");
let s = fs.readFileSync(f, "utf8");
if (s.includes("KEYV_REDIS_URL")) { console.log("already patched services/db/keyv.js (redis)"); process.exit(0); }
const edit = (a, b) => { if (!s.includes(a)) { console.error(`MISSING in services/db/keyv.js: ${a.slice(0, 60)}`); process.exit(1); } s = s.replace(a, b); };

// Refresh tokens and one-time codes live in keyv. In memory (the template default) a restart of the API logs
// everyone out and a second instance cannot share sessions; with KEYV_REDIS_URL set they live in Redis instead.
// Left unset, behaviour is exactly the template's.
edit(`import { Keyv } from 'keyv';`, `import { Keyv } from 'keyv';
import KeyvRedis from '@keyv/redis';`);
edit(`  open() {
    this._keyv = this._KEYV_CACHE ? new Keyv(this._KEYV_CACHE) : new Keyv();`,
`  open() {
    const redisUrl = process.env.KEYV_REDIS_URL;
    if (redisUrl) {
      this._keyv = new Keyv({ ...this._KEYV_CACHE, store: new KeyvRedis(redisUrl) });
      logger.info('keyv: sessions and one-time codes stored in Redis');
    } else {
      this._keyv = this._KEYV_CACHE ? new Keyv(this._KEYV_CACHE) : new Keyv();
      logger.info('keyv: in-memory store (set KEYV_REDIS_URL to use Redis)');
    }`);

fs.writeFileSync(f, s);

const pkgPath = path.join(root, "common/compiled/node/package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
if (!pkg.dependencies["@keyv/redis"]) { pkg.dependencies["@keyv/redis"] = "^4.0.0"; fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n"); console.log("added @keyv/redis dependency"); }
console.log("patched services/db/keyv.js (Redis when KEYV_REDIS_URL is set)");
