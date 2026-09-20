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

// The template keeps ONE refresh token per user, so signing in on a phone signed the laptop out. Now the store holds
// a list of sessions per user (token, device, address, created, last seen; at most 8, oldest evicted): each sign-in
// adds one, a refresh replaces its own, logout removes its own, "sign out everywhere" removes all. Reuse detection
// (0015) still revokes the whole list. The list itself is exposed as GET /api/auth/sessions (kit file sessions.js).
edit("common/compiled/node/auth/keyv.js", "MAX_SESSIONS", [
  [`const setRefreshToken = async (id, refresh_token) => keyv.set(String(id), refresh_token);
const getRefreshToken = async id => keyv.get(String(id));
const revokeRefreshToken = async id => keyv.delete(String(id));`,
   `// Sessions per user (patch 0020): the value under the bare user id is an array, newest last.
const MAX_SESSIONS = Number(process.env.AUTH_MAX_SESSIONS || 8);
const listSessions = async id => {
  const v = await keyv.get(String(id));
  return Array.isArray(v) ? v : v ? [{ token: String(v), device: 'unknown', ip: '', at: 0, seen: 0 }] : [];
};
const setRefreshToken = async (id, refresh_token, session = {}) => {
  const now = Date.now();
  let list = (await listSessions(id)).filter(s => s.token !== session.replace);
  list.push({ token: refresh_token, device: (session.device || 'unknown').slice(0, 160), ip: (session.ip || '').slice(0, 64), at: session.at || now, seen: now });
  if (list.length > MAX_SESSIONS) list = list.slice(list.length - MAX_SESSIONS);
  return keyv.set(String(id), list);
};
const findSession = async (id, token) => (await listSessions(id)).find(s => s.token === token) || null;
// Kept for the template's own callers: "the" refresh token is the newest session's.
const getRefreshToken = async id => (await listSessions(id)).at(-1)?.token;
const revokeRefreshToken = async id => keyv.delete(String(id));
const revokeSession = async (id, token) => {
  const list = (await listSessions(id)).filter(s => s.token !== token);
  return list.length ? keyv.set(String(id), list) : keyv.delete(String(id));
};`],
  [`export {
  clearLockout,`, `export {
  clearLockout,
  findSession,
  listSessions,
  revokeSession,`],
], "sessions per device");

edit("common/compiled/node/auth/index.js", "sessionMeta", [
  [`let setRefreshToken, getRefreshToken, setRefreshTokenStoreName, setTokenService, setUserService, setAuthUserStoreName;`,
   `let setRefreshToken, getRefreshToken, setRefreshTokenStoreName, setTokenService, setUserService, setAuthUserStoreName;
let findSession, revokeSession, listSessionsOf;
// What a session remembers about the device that opened it (shown on the Profile page, never used for authorisation).
const sessionMeta = (req, extra = {}) => ({
  device: String(req?.get?.('user-agent') || 'unknown').replace(/\\s+/g, ' '),
  ip: String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim() || req?.ip || '',
  ...extra,
});`],
  [`  ({
    setRefreshToken,
    getRefreshToken,
    retireRefreshToken,
    getRetiredRefreshToken,`, `  ({
    setRefreshToken,
    getRefreshToken,
    findSession,
    revokeSession,
    listSessions: listSessionsOf,
    retireRefreshToken,
    getRetiredRefreshToken,`],
  [`const createToken = async user => {`, `// A non-secret handle for a session: the first 12 hex chars of its refresh token's SHA-256 (also the \`sid\` claim).
const sessionKey = token => crypto.createHash('sha256').update(String(token)).digest('hex').slice(0, 12);

const createToken = async (user, session = {}) => {
  // the refresh token first: its key travels in the access token as \`sid\`, so logout and the sessions list know which device this is
  const refresh_token = crypto.randomBytes(JWT_REFRESH_TOKEN_BYTE_LEN).toString('base64url');`],
  [`    roles, // coarse-grained roles (FGA or DB column)`, `    roles, // coarse-grained roles (FGA or DB column)
    sid: sessionKey(refresh_token), // this device's session (patch 0020)`],
  [`  options.expiresIn = JWT_REFRESH_EXPIRY_SEC;
  const refresh_token = crypto.randomBytes(JWT_REFRESH_TOKEN_BYTE_LEN).toString('base64url');
  await setRefreshToken(sub, refresh_token); // store in DB or Cache`, `  options.expiresIn = JWT_REFRESH_EXPIRY_SEC;
  await setRefreshToken(sub, refresh_token, session); // one session per device (patch 0020)`],
  [`    const refreshToken = await getRefreshToken(sub);
    let current = !!refreshToken && String(refreshToken) === String(refresh_token);`,
   `    const own = refresh_token && findSession ? await findSession(sub, String(refresh_token)) : null;
    const refreshToken = own ? own.token : await getRefreshToken(sub);
    let current = !!own || (!!refreshToken && String(refreshToken) === String(refresh_token));`],
  [`      const tokens = await createToken(user); // stores the new refresh token; the old one is retired below
      if (retireRefreshToken && refreshToken) await retireRefreshToken(refreshToken, sub, JWT_REFRESH_EXPIRY_SEC * 1000);`,
   `      const tokens = await createToken(user, sessionMeta(req, { replace: String(refresh_token), at: own?.at })); // this device's session is replaced; the old token is retired below
      if (retireRefreshToken && refresh_token) await retireRefreshToken(String(refresh_token), sub, JWT_REFRESH_EXPIRY_SEC * 1000);`],
  [`export { authFns, authRefresh, authUser, createToken, getSecret, setTokensToHeader, setup, tokensForClient };`,
   `export { authFns, authRefresh, authUser, createToken, getSecret, sessionMeta, setTokensToHeader, setup, tokensForClient };
export const revokeOwnSession = async (id, sid) => {
  if (!revokeSession || !findSession) return authFns.revokeRefreshToken(id);
  const target = (await listSessionsOf(id)).find(s => sessionKey(s.token) === sid);
  return target ? revokeSession(id, target.token) : null;
};
export { sessionKey };`],
], "sessions per device");

edit("common/compiled/node/express/controller/auth/own.js", "sessionMeta(req)", [
  [`import { authFns, createToken, getSecret, setTokensToHeader, tokensForClient } from '../../../auth/index.js';`,
   `import { authFns, createToken, getSecret, revokeOwnSession, sessionMeta, setTokensToHeader, tokensForClient } from '../../../auth/index.js';`],
  [`    const tokens = await createToken(user); // 5 minute expire for login`, `    const tokens = await createToken(user, sessionMeta(req)); // 5 minute expire for login`],
  [`        const tokens = await createToken(user);`, `        const tokens = await createToken(user, sessionMeta(req));`],
  [`    const tokens = await createToken(user);
    setTokensToHeader(res, tokens);
    return res.status(201).json(tokensForClient(tokens));`, `    const tokens = await createToken(user, sessionMeta(req));
    setTokensToHeader(res, tokens);
    return res.status(201).json(tokensForClient(tokens));`],
  // logout: this device only, unless ?all=1 ("sign out everywhere")
  [`  let id = null;
  try {`, `  let id = null;
  let sid = null;
  try {`],
  [`    id = user.sub;`, `    id = user.sub;
    sid = user.sid;`],
  [`      await authFns.revokeRefreshToken(id); // clear`, `      if (req.query?.all === '1' || !sid) await authFns.revokeRefreshToken(id); // every device
      else await revokeOwnSession(id, sid); // this device only`],
], "sessions per device");

edit("common/compiled/node/express/controller/auth/google.js", "sessionMeta(req)", [
  [`import { authFns, createToken, setTokensToHeader, tokensForClient } from '../../../auth/index.js';`,
   `import { authFns, createToken, sessionMeta, setTokensToHeader, tokensForClient } from '../../../auth/index.js';`],
  [`    const ours = await createToken(user);`, `    const ours = await createToken(user, sessionMeta(req));`],
], "sessions per device");

// GET /api/auth/sessions, DELETE /api/auth/sessions/:key (kit file)
const src = path.join(__dirname, "sessions.js"), dst = path.join(root, "apps/sample-api/src/routes/sessions.js");
if (!fs.existsSync(dst) || fs.readFileSync(dst, "utf8") !== fs.readFileSync(src, "utf8")) { fs.copyFileSync(src, dst); console.log("installed apps/sample-api/src/routes/sessions.js"); }
else console.log("already installed routes/sessions.js");
const idx = path.join(root, "apps/sample-api/src/routes/index.js");
let i = fs.readFileSync(idx, "utf8");
if (!i.includes("router.use('/auth', sessions)")) {
  const imp = `import users from './users.js';`;
  const m = `    router.use('/users', users),`;
  if (!i.includes(imp) || !i.includes(m)) { console.error("routes/index.js markers not found (apply 0016 first)"); process.exit(1); }
  i = i.replace(imp, `${imp}
import sessions from './sessions.js';`);
  i = i.replace(m, `${m}
    router.use('/auth', sessions),`);
  fs.writeFileSync(idx, i); console.log("patched apps/sample-api/src/routes/index.js (sessions)");
} else console.log("already patched routes/index.js (sessions)");
