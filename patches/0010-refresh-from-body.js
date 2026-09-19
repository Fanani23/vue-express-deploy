const fs = require("fs"), path = require("path");
const root = process.argv[2];
const f = path.join(root, "common/compiled/node/auth/index.js");
let s = fs.readFileSync(f, "utf8");
if (s.includes("req.body?.refresh_token")) { console.log("already patched auth/index.js (refresh from body)"); process.exit(0); }
const before = `    const refresh_token = req.cookies?.refresh_token || req.header('refresh_token') || req.query?.refresh_token; // check refresh token & user - always stateful
    const access_token = req.cookies?.access_token || req.header('access_token') || req.query?.access_token; // check refresh token & user - always stateful`;
const after = `    const refresh_token = req.body?.refresh_token || req.cookies?.refresh_token || req.header('refresh_token') || req.query?.refresh_token;
    const bearer = (req.header('authorization') || '').replace(/^Bearer\\s+/i, '');
    const access_token = req.body?.access_token || bearer || req.cookies?.access_token || req.header('access_token') || req.query?.access_token;`;
if (!s.includes(before)) { console.error("authRefresh marker not found in auth/index.js"); process.exit(1); }
s = s.replace(before, after);
const lookupBefore = "      const user = await authFns.findUser({ [AUTH_USER_FIELD_LOGIN]: sub });";
const lookupAfter = "      const user = await authFns.findUser({ [AUTH_USER_FIELD_ID_FOR_JWT]: sub });";
if (!s.includes(lookupBefore)) { console.error("authRefresh user lookup marker not found"); process.exit(1); }
s = s.replace(lookupBefore, lookupAfter);
fs.writeFileSync(f, s);
console.log("patched auth/index.js (refresh: token from JSON body/bearer as the client sends it; user looked up by the id in the token, not by email)");
