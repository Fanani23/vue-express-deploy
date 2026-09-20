const fs = require("fs"), path = require("path");
const root = process.argv[2];
const edit = (rel, marker, pairs, what) => {
  const f = path.join(root, rel);
  let s = fs.readFileSync(f, "utf8");
  if (s.includes(marker)) { console.log(`already patched ${rel} (${what})`); return; }
  for (const [a, b] of pairs) { if (!s.includes(a)) { console.error(`MISSING in ${rel}: ${a.slice(0, 70)}`); process.exit(1); } s = s.split(a).join(b); }
  fs.writeFileSync(f, s);
  console.log(`patched ${rel} (${what})`);
};

// The template already issues a fresh refresh token on every /refresh (the one stored per user is overwritten), but
// it never *detects reuse*: presenting an old, rotated-away token was just a 401 while the stolen session lived on.
// Now every rotated-out token is remembered for the refresh lifetime; when one is presented again the whole family
// is revoked (the user's current refresh token is deleted) so both the victim and the thief have to sign in again.
// A short leeway covers two tabs refreshing in the same instant with the same cookie.
edit("common/compiled/node/auth/keyv.js", "retireRefreshToken", [
  [`const revokeRefreshToken = async id => keyv.delete(String(id));`,
   `const revokeRefreshToken = async id => keyv.delete(String(id));

// Rotated-out refresh tokens, kept for the refresh lifetime so that a replay is recognised (reuse detection).
const retireRefreshToken = async (token, id, ttlMs) => keyv.set(\`retired:\${token}\`, { id: String(id), at: Date.now() }, ttlMs);
const getRetiredRefreshToken = async token => keyv.get(\`retired:\${token}\`);`],
  [`export {
  consumeOtpCode,`, `export {
  consumeOtpCode,
  getRetiredRefreshToken,
  retireRefreshToken,`],
], "refresh token reuse detection store");

edit("common/compiled/node/auth/index.js", "REFRESH_REUSE_LEEWAY_MS", [
  [`let setRefreshToken, getRefreshToken, setRefreshTokenStoreName, setTokenService, setUserService, setAuthUserStoreName;`, `let setRefreshToken, getRefreshToken, setRefreshTokenStoreName, setTokenService, setUserService, setAuthUserStoreName;
let retireRefreshToken;
let getRetiredRefreshToken;
// Two tabs can refresh with the same cookie in the same instant; a replay this soon after rotation is benign.
const REFRESH_REUSE_LEEWAY_MS = 10 * 1000;`],
  [`  ({
    setRefreshToken,
    getRefreshToken,
    revokeRefreshToken: authFns.revokeRefreshToken,`, `  ({
    setRefreshToken,
    getRefreshToken,
    retireRefreshToken,
    getRetiredRefreshToken,
    revokeRefreshToken: authFns.revokeRefreshToken,`],
  [`    const refreshToken = await getRefreshToken(sub);
    if (String(refreshToken) === String(refresh_token)) {
      const user = await authFns.findUser({ [AUTH_USER_FIELD_ID_FOR_JWT]: sub });
      // TODO user also include tenant and other information
      const tokens = await createToken(user);
      setTokensToHeader(res, tokens);
      return res.status(200).json(tokensForClient(tokens));
    } else {
      return res.status(401).json({ message: 'Refresh Token Error: Uncaught' });
    }`, `    const refreshToken = await getRefreshToken(sub);
    let current = !!refreshToken && String(refreshToken) === String(refresh_token);
    if (!current && refresh_token && getRetiredRefreshToken) {
      const retired = await getRetiredRefreshToken(refresh_token);
      if (retired && retired.id === String(sub)) {
        if (Date.now() - retired.at > REFRESH_REUSE_LEEWAY_MS) {
          // A token that was already rotated away is being presented again: replayed or stolen. Revoke the family.
          await authFns.revokeRefreshToken(sub);
          return res.status(401).json({ message: 'Refresh Token Reuse' });
        }
        current = true; // same-instant refresh from another tab
      }
    }
    if (current) {
      const user = await authFns.findUser({ [AUTH_USER_FIELD_ID_FOR_JWT]: sub });
      // TODO user also include tenant and other information
      const tokens = await createToken(user); // stores the new refresh token; the old one is retired below
      if (retireRefreshToken && refreshToken) await retireRefreshToken(refreshToken, sub, JWT_REFRESH_EXPIRY_SEC * 1000);
      setTokensToHeader(res, tokens);
      return res.status(200).json(tokensForClient(tokens));
    } else {
      return res.status(401).json({ message: 'Refresh Token Error: Uncaught' });
    }`],
], "refresh token rotation with reuse detection");
