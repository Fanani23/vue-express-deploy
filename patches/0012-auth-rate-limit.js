const fs = require("fs"), path = require("path");
const root = process.argv[2];
const f = path.join(root, "apps/sample-api/src/routes/auth.js");
let s = fs.readFileSync(f, "utf8");
if (s.includes("authRateLimit")) { console.log("already patched routes/auth.js (rate limit)"); process.exit(0); }
const edit = (a, b) => { if (!s.includes(a)) { console.error(`MISSING in routes/auth.js: ${a.slice(0, 60)}`); process.exit(1); } s = s.replace(a, b); };

// Brute-force protection for the three endpoints that take a secret: at most AUTH_RATE_LIMIT attempts per client
// address per minute (default 10), answered with 429 + Retry-After. In-memory on purpose: the template runs as one
// process, and a restart resetting the counters is harmless.
edit(`import express from 'express';
`,
`import express from 'express';

const AUTH_RATE_LIMIT = Number(process.env.AUTH_RATE_LIMIT || 10);
const AUTH_RATE_WINDOW_MS = 60 * 1000;
const attempts = new Map();
const authRateLimit = (req, res, next) => {
  const key = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter((t) => now - t < AUTH_RATE_WINDOW_MS);
  if (recent.length >= AUTH_RATE_LIMIT) {
    res.set('Retry-After', String(Math.ceil((AUTH_RATE_WINDOW_MS - (now - recent[0])) / 1000)));
    return res.status(429).json({ message: 'Too many attempts - try again in a minute' });
  }
  recent.push(now);
  attempts.set(key, recent);
  if (attempts.size > 10000) attempts.clear();
  return next();
};
`);

edit(`  .post('/login', own.login)
  .post('/otp', own.otp)`,
`  .post('/login', authRateLimit, own.login)
  .post('/otp', authRateLimit, own.otp)`);
edit(`  .post('/signup', own.signup)`, `  .post('/signup', authRateLimit, own.signup)`);

fs.writeFileSync(f, s);
console.log("patched routes/auth.js (rate limit on login, otp, signup)");
