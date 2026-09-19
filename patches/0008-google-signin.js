const fs = require("fs"), path = require("path");
const root = process.argv[2];

const rf = path.join(root, "apps/sample-api/src/routes/auth.js");
let r = fs.readFileSync(rf, "utf8");
if (!r.includes("googleRoute")) {
  r = r.replace(`import { oauth, oidc, own, saml } from '@common/node/express/controller/auth';`,
                `import { oauth, oidc, own, saml } from '@common/node/express/controller/auth';
import * as google from '@common/node/express/controller/auth/google';`);
  r = r.replace(`export const oauthRoute = express.Router().get('/callback', oauth.callbackOAuth);`,
                `export const oauthRoute = express.Router().get('/callback', oauth.callbackOAuth);
export const googleRoute = express.Router().get('/login', google.login).get('/callback', google.callback);`);
  r = r.replace(`      github: usable(id) && usable(secret),`,
                `      github: usable(id) && usable(secret),
      google: google.enabled(),`);
  if (!r.includes("googleRoute") || !r.includes("google: google.enabled()")) { console.error("routes/auth.js markers not found (apply 0007 first)"); process.exit(1); }
  fs.writeFileSync(rf, r); console.log("patched apps/sample-api/src/routes/auth.js (google)");
} else console.log("already patched routes/auth.js (google)");

const idx = path.join(root, "apps/sample-api/src/routes/index.js");
let i = fs.readFileSync(idx, "utf8");
if (!i.includes("auth.googleRoute")) {
  const m = `    router.use('/oauth', auth.oauthRoute),`;
  if (!i.includes(m)) { console.error("routes/index.js marker not found"); process.exit(1); }
  i = i.replace(m, `${m}
    router.use('/google', auth.googleRoute),`);
  fs.writeFileSync(idx, i); console.log("patched apps/sample-api/src/routes/index.js (google)");
} else console.log("already patched routes/index.js (google)");

console.log("google controller: common/compiled/node/express/controller/auth/google.js (copied by apply.sh)");
