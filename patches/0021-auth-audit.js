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

// Sign-in events go to TaskPulse's audit trail (resource "auth": signin, signin-failed, otp-failed, lockout, signout,
// signout-all, reuse; resource "account": what an Admin does to accounts), so one screen shows who did what, when,
// from where - the same trail the task changes are in. Reporter: kit file audit-client.js.
const src = path.join(__dirname, "audit-client.js"), dst = path.join(root, "common/compiled/node/services/audit.js");
if (!fs.existsSync(dst) || fs.readFileSync(dst, "utf8") !== fs.readFileSync(src, "utf8")) { fs.copyFileSync(src, dst); console.log("installed services/audit.js"); }
else console.log("already installed services/audit.js");

edit("common/compiled/node/express/controller/auth/own.js", "auditEvent(req", [
  [`import { sendMail } from '../../../services/mailer.js';`, `import { sendMail } from '../../../services/mailer.js';
import { auditEvent } from '../../../services/audit.js';`],
  // wrong password (with lockout, patch 0019)
  [`      const failure = accountId ? await failedLogin(accountId, AUTH_LOCKOUT_ATTEMPTS, AUTH_LOCKOUT_MS) : { attempts: 0, lockedUntil: null };
      if (failure.lockedUntil) return res.status(423).json({ message: lockedMessage(failure.lockedUntil), lockedUntil: new Date(failure.lockedUntil).toISOString() });
      const left = AUTH_LOCKOUT_ATTEMPTS - failure.attempts;`,
   `      const failure = accountId ? await failedLogin(accountId, AUTH_LOCKOUT_ATTEMPTS, AUTH_LOCKOUT_MS) : { attempts: 0, lockedUntil: null };
      if (failure.lockedUntil) {
        auditEvent(req, { actor: user.email, action: 'lockout', targetId: accountId, summary: \`account locked after \${AUTH_LOCKOUT_ATTEMPTS} wrong passwords\` });
        return res.status(423).json({ message: lockedMessage(failure.lockedUntil), lockedUntil: new Date(failure.lockedUntil).toISOString() });
      }
      const left = AUTH_LOCKOUT_ATTEMPTS - failure.attempts;
      auditEvent(req, { actor: user.email, action: 'signin-failed', targetId: accountId, summary: \`wrong password (\${left} attempt(s) left)\` });`],
  // right password: the password step passed (the session starts at the code step)
  [`    if (accountId) await clearLockout(accountId);
    if (user.revoked) return res.status(401).json({ message: 'Revoked credentials' });`,
   `    if (accountId) await clearLockout(accountId);
    if (user.revoked) {
      auditEvent(req, { actor: user.email, action: 'signin-failed', targetId: accountId, summary: 'revoked account tried to sign in' });
      return res.status(401).json({ message: 'Revoked credentials' });
    }`],
  // code step
  [`        return res.status(200).json(tokensForClient(tokens));
      } else {
        return res.status(401).json({ message: 'Error token wrong pin' });`,
   `        auditEvent(req, { actor: user.email, action: 'signin', targetId: id, summary: user.otp_pin ? 'signed in (fixed code)' : 'signed in (one-time code)' });
        return res.status(200).json(tokensForClient(tokens));
      } else {
        auditEvent(req, { actor: user.email, action: 'otp-failed', targetId: id, summary: 'wrong one-time code' });
        return res.status(401).json({ message: 'Error token wrong pin' });`],
  // logout (per device / everywhere, patch 0020)
  [`  let sid = null;
  try {`, `  let sid = null;
  let actorEmail = null;
  try {`],
  [`    sid = user.sid;`, `    sid = user.sid;
    actorEmail = user.user_meta?.email;`],
  [`      if (req.query?.all === '1' || !sid) await authFns.revokeRefreshToken(id); // every device
      else await revokeOwnSession(id, sid); // this device only`,
   `      if (req.query?.all === '1' || !sid) await authFns.revokeRefreshToken(id); // every device
      else await revokeOwnSession(id, sid); // this device only
      auditEvent(req, { actor: actorEmail, action: req.query?.all === '1' ? 'signout-all' : 'signout', targetId: id, summary: req.query?.all === '1' ? 'signed out everywhere' : 'signed out this device' });`],
], "auth audit");

edit("common/compiled/node/auth/index.js", "auditEvent(req", [
  [`import * as keyv from './keyv.js';`, `import * as keyv from './keyv.js';
import { auditEvent } from '../services/audit.js';`],
  [`          await authFns.revokeRefreshToken(sub);
          return res.status(401).json({ message: 'Refresh Token Reuse' });`,
   `          await authFns.revokeRefreshToken(sub);
          auditEvent(req, { actor: user?.user_meta?.email, action: 'reuse', targetId: sub, summary: 'rotated-away refresh token presented again - every session revoked' });
          return res.status(401).json({ message: 'Refresh Token Reuse' });`],
], "auth audit");

// Google sign-in
edit("common/compiled/node/express/controller/auth/google.js", "auditEvent(req", [
  [`import { authFns, createToken, sessionMeta, setTokensToHeader, tokensForClient } from '../../../auth/index.js';`,
   `import { authFns, createToken, sessionMeta, setTokensToHeader, tokensForClient } from '../../../auth/index.js';
import { auditEvent } from '../../../services/audit.js';`],
  [`    const ours = await createToken(user, sessionMeta(req));`, `    const ours = await createToken(user, sessionMeta(req));
    auditEvent(req, { actor: user.email, action: 'signin', targetId: user.id, summary: 'signed in with Google' });`],
], "auth audit");
