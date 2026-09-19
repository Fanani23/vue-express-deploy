const fs = require("fs");
const p = process.argv[2];
let s = fs.readFileSync(p, "utf8");
if (s.includes("name: 'SignUp'")) { console.log("route /signup already registered"); process.exit(0); }
const anchor = "  { path: '/signin', name: 'SignIn', component: () => import('../views/SignIn.vue') },";
if (!s.includes(anchor)) { console.error("signin route anchor not found in " + p); process.exit(1); }
s = s.replace(anchor, anchor + "\n  { path: '/signup', name: 'SignUp', component: () => import('../views/SignIn.vue') },");
fs.writeFileSync(p, s);
console.log("route /signup registered");
