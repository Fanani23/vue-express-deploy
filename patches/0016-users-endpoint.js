const fs = require("fs"), path = require("path");
const root = process.argv[2];

// /api/users: the portal's "Team members" are real accounts on the template's users table (kit file users.js).
const src = path.join(__dirname, "users.js"), dst = path.join(root, "apps/sample-api/src/routes/users.js");
if (!fs.existsSync(dst) || fs.readFileSync(dst, "utf8") !== fs.readFileSync(src, "utf8")) { fs.copyFileSync(src, dst); console.log("installed apps/sample-api/src/routes/users.js"); }
else console.log("already installed routes/users.js");

const idx = path.join(root, "apps/sample-api/src/routes/index.js");
let i = fs.readFileSync(idx, "utf8");
if (!i.includes("router.use('/users', users)")) {
  const imp = `import * as auth from './auth.js';`;
  const m = `    router.use('/google', auth.googleRoute),`;
  if (!i.includes(imp) || !i.includes(m)) { console.error("routes/index.js markers not found (apply 0008 first)"); process.exit(1); }
  i = i.replace(imp, `${imp}
import users from './users.js';`);
  i = i.replace(m, `${m}
    router.use('/users', users),`);
  fs.writeFileSync(idx, i); console.log("patched apps/sample-api/src/routes/index.js (users)");
} else console.log("already patched routes/index.js (users)");
