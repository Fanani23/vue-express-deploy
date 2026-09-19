const fs = require("fs"), path = require("path");
const root = process.argv[2];
const f = path.join(root, "apps/sample-api/src/routes/auth.js");
let s = fs.readFileSync(f, "utf8");
if (s.includes("'/providers'")) { console.log("already patched routes/auth.js (providers)"); process.exit(0); }
const marker = `  .post('/signup', own.signup);`;
if (!s.includes(marker)) { console.error("signup route marker not found (apply 0005 first)"); process.exit(1); }
s = s.replace(marker, `  .post('/signup', own.signup)
  .get('/providers', (req, res) => {
    const o = globalThis.__config?.OAUTH_OPTIONS || {};
    const id = process.env.OAUTH_CLIENT_ID || o.CLIENT_ID || '';
    const secret = process.env.OAUTH_CLIENT_SECRET || o.CLIENT_SECRET || '';
    const usable = v => typeof v === 'string' && v.length >= 10 && !v.includes('<'); // '<REDACTED>' placeholder = unset
    res.json({
      github: usable(id) && usable(secret),
      githubClientId: usable(id) ? id : '',
      otp: process.env.USE_OTP || '',
    });
  });`);
fs.writeFileSync(f, s);
console.log("patched apps/sample-api/src/routes/auth.js (providers)");
