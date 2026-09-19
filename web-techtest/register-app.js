const fs = require("fs");
const p = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
pkg.scripts.techtest = "vite --config web-techtest/vite.config.js --mode development";
pkg.scripts["techtest:build"] = "vite build --config web-techtest/vite.config.js";
fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n");
console.log("npm scripts: techtest, techtest:build");
