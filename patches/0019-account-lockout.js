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

// Per-account lockout, next to the per-address rate limit (0012): AUTH_LOCKOUT_ATTEMPTS wrong passwords (5) lock the
// account for AUTH_LOCKOUT_SECONDS (900) - a 423 that says so, even with the right password. Kept in the keyv store
// (Redis on the box), so it survives a restart and is shared by every API process. An Admin can unlock (0016).
edit("common/compiled/node/auth/keyv.js", "clearLockout", [
  [`const setUserService = () => {};`, `// Account lockout after repeated wrong passwords (patch 0019). Keys are per user id, with the lock's TTL.
const failedLogin = async (id, maxAttempts, lockMs) => {
  const attempts = ((await keyv.get(\`lockout:attempts:\${id}\`)) || 0) + 1;
  if (attempts >= maxAttempts) {
    const until = Date.now() + lockMs;
    await keyv.set(\`lockout:locked:\${id}\`, until, lockMs);
    await keyv.delete(\`lockout:attempts:\${id}\`);
    return { attempts, lockedUntil: until };
  }
  await keyv.set(\`lockout:attempts:\${id}\`, attempts, lockMs);
  return { attempts, lockedUntil: null };
};
const lockedUntil = async id => {
  const until = await keyv.get(\`lockout:locked:\${id}\`);
  return until && until > Date.now() ? until : null;
};
const clearLockout = async id => {
  await keyv.delete(\`lockout:locked:\${id}\`);
  await keyv.delete(\`lockout:attempts:\${id}\`);
};

const setUserService = () => {};`],
  [`export {
  consumeOtpCode,`, `export {
  clearLockout,
  consumeOtpCode,
  failedLogin,
  lockedUntil,`],
], "account lockout store");

edit("common/compiled/node/express/controller/auth/own.js", "AUTH_LOCKOUT_ATTEMPTS", [
  [`import { consumeOtpCode, setOtpCode } from '../../../auth/keyv.js';`,
   `import { clearLockout, consumeOtpCode, failedLogin, lockedUntil, setOtpCode } from '../../../auth/keyv.js';

const AUTH_LOCKOUT_ATTEMPTS = Number(process.env.AUTH_LOCKOUT_ATTEMPTS || 5);
const AUTH_LOCKOUT_MS = Number(process.env.AUTH_LOCKOUT_SECONDS || 900) * 1000;
const lockedMessage = until => \`Too many wrong passwords - this account is locked for \${Math.max(1, Math.ceil((until - Date.now()) / 60000))} minute(s)\`;`],
  [`    if (!user) return res.status(401).json({ message: 'Incorrect credentials...1' });`,
   `    if (!user) return res.status(401).json({ message: 'Incorrect credentials...1' });
    const accountId = user[AUTH_USER_FIELD_ID_FOR_JWT];
    const until = accountId ? await lockedUntil(accountId) : null;
    if (until) return res.status(423).json({ message: lockedMessage(until), lockedUntil: new Date(until).toISOString() });`],
  [`    ) {
      return res.status(401).json({ message: 'Incorrect credentials...2' });
    }
    if (user.revoked) return res.status(401).json({ message: 'Revoked credentials' });`,
   `    ) {
      const failure = accountId ? await failedLogin(accountId, AUTH_LOCKOUT_ATTEMPTS, AUTH_LOCKOUT_MS) : { attempts: 0, lockedUntil: null };
      if (failure.lockedUntil) return res.status(423).json({ message: lockedMessage(failure.lockedUntil), lockedUntil: new Date(failure.lockedUntil).toISOString() });
      const left = AUTH_LOCKOUT_ATTEMPTS - failure.attempts;
      return res.status(401).json({ message: left <= 2 ? \`Incorrect credentials - \${left} attempt(s) left before the account is locked\` : 'Incorrect credentials...2', attemptsLeft: left });
    }
    if (accountId) await clearLockout(accountId);
    if (user.revoked) return res.status(401).json({ message: 'Revoked credentials' });`],
], "account lockout");
