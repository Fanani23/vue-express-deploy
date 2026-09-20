const fs = require("fs"), path = require("path");
const root = process.argv[2];
const edit = (rel, marker, pairs) => {
  const f = path.join(root, rel);
  let s = fs.readFileSync(f, "utf8");
  if (s.includes(marker)) { console.log("already patched " + rel + " (httponly refresh)"); return; }
  for (const [a, b] of pairs) { if (!s.includes(a)) { console.error(`MISSING in ${rel}: ${a.slice(0, 60)}`); process.exit(1); } s = s.split(a).join(b); }
  fs.writeFileSync(f, s);
  console.log("patched " + rel + " (httponly refresh)");
};

// The template's COOKIE_HTTPONLY mode already writes the refresh token into an HttpOnly cookie scoped to the
// refresh path, but it still returned the same token in the JSON body (so the browser kept a copy anyway) and its
// refresh handler read the access token from a cookie it never sets. With this patch, in cookie mode:
//   - the JSON responses of /otp, /signup and /refresh carry the access token only (`tokensForClient`);
//   - /refresh reads the access token from the Authorization cookie ("Bearer ...") as well as body/header.
edit("common/compiled/node/auth/index.js", "tokensForClient", [
  [`const setTokensToHeader = (res, { access_token, refresh_token }) => {`,
   `// What the browser may hold: everything, or - in HttpOnly cookie mode - everything except the refresh token.
const tokensForClient = tokens => (COOKIE_HTTPONLY ? (({ refresh_token, ...rest }) => rest)(tokens) : tokens);

const setTokensToHeader = (res, { access_token, refresh_token }) => {`],
  [`    const bearer = (req.header('authorization') || '').replace(/^Bearer\\s+/i, '');`,
   `    const bearer = (req.header('authorization') || req.cookies?.Authorization || '').replace(/^Bearer\\s+/i, '');`],
  [`      setTokensToHeader(res, tokens);
      return res.status(200).json(tokens);`,
   `      setTokensToHeader(res, tokens);
      return res.status(200).json(tokensForClient(tokens));`],
  [`export { authFns, authRefresh, authUser, createToken, getSecret, setTokensToHeader, setup };`,
   `export { authFns, authRefresh, authUser, createToken, getSecret, setTokensToHeader, setup, tokensForClient };`],
]);

edit("common/compiled/node/express/controller/auth/own.js", "tokensForClient", [
  [`import { authFns, createToken, getSecret, setTokensToHeader } from '../../../auth/index.js';`,
   `import { authFns, createToken, getSecret, setTokensToHeader, tokensForClient } from '../../../auth/index.js';`],
  [`    setTokensToHeader(res, tokens);
    return res.status(200).json(tokens);`,
   `    setTokensToHeader(res, tokens);
    return res.status(200).json(tokensForClient(tokens));`],
  [`        setTokensToHeader(res, tokens);
        return res.status(200).json(tokens);`,
   `        setTokensToHeader(res, tokens);
        return res.status(200).json(tokensForClient(tokens));`],
  [`    setTokensToHeader(res, tokens);
    return res.status(201).json(tokens);`,
   `    setTokensToHeader(res, tokens);
    return res.status(201).json(tokensForClient(tokens));`],
]);
