const fs = require("fs"), path = require("path");
const root = process.argv[2];
const f = path.join(root, "common/compiled/node/auth/index.js");
let s = fs.readFileSync(f, "utf8");
if (s.includes("user_meta, // AUTH_USER_FIELDS_JWT_PAYLOAD")) { console.log("already patched auth/index.js (user_meta claim)"); process.exit(0); }
const edit = (a, b) => { if (!s.includes(a)) { console.error(`MISSING in auth/index.js: ${a.slice(0, 60)}`); process.exit(1); } s = s.replace(a, b); };

// AUTH_USER_FIELDS_JWT_PAYLOAD promises the listed user fields inside the JWT payload; the template only returned
// them next to the token. Putting them in the payload lets a second service (TaskPulse) know who the caller is.
edit(`    scope: JWT_SCOPE,
    roles, // coarse-grained roles (FGA or DB column)`,
`    scope: JWT_SCOPE,
    roles, // coarse-grained roles (FGA or DB column)
    user_meta, // AUTH_USER_FIELDS_JWT_PAYLOAD (email, groups) - also read by TaskPulse for its audit trail`);

fs.writeFileSync(f, s);
console.log("patched auth/index.js (user_meta claim in the access token)");
