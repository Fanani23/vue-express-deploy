const fs = require("fs"), path = require("path");
const root = process.argv[2];
const f = path.join(root, "apps/sample-api/src/routes/index.js");
let s = fs.readFileSync(f, "utf8");
const marker = `  app.use(
    '/api',
    router.use('/auth', auth.myauthRoute),`;
if (!s.includes(marker)) { console.error("pattern not found in routes/index.js"); process.exit(1); }
if (s.includes("oauth callback alias")) { console.log("already patched routes/index.js"); process.exit(0); }
s = s.replace(marker, `  // oauth callback alias: GitHub redirects to http://<host>/auth -> same handler as /api/oauth/callback
  app.get('/auth', (req, res, next) => {
    req.url = '/callback';
    auth.oauthRoute(req, res, next);
  });

${marker}`);
fs.writeFileSync(f, s);
console.log("patched apps/sample-api/src/routes/index.js");
