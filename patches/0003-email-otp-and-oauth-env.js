const fs = require("fs"), path = require("path");
const root = process.argv[2];
const edit = (rel, pairs) => {
  const f = path.join(root, rel); let s = fs.readFileSync(f, "utf8");
  for (const [a, b] of pairs) { if (!s.includes(a)) { console.error(`MISSING in ${rel}: ${a.slice(0, 60)}`); process.exit(1); } s = s.replace(a, b); }
  fs.writeFileSync(f, s); console.log("patched " + rel);
};

edit("common/compiled/node/auth/keyv.js", [[
`const revokeRefreshToken = async id => keyv.delete(String(id));`,
`const revokeRefreshToken = async id => keyv.delete(String(id));

// EMAIL one-time codes: short-lived, single-use, attempt-limited. Keys are namespaced so they can
// never collide with refresh tokens (which are keyed by the bare user id).
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const setOtpCode = async (id, code) => {
  await keyv.set(\`otp:\${id}\`, code, OTP_TTL_MS);
  await keyv.set(\`otp-attempts:\${id}\`, 0, OTP_TTL_MS);
};
/** Returns true and consumes the code when it matches; false otherwise. Wipes the code after too many misses. */
const consumeOtpCode = async (id, pin) => {
  const expected = await keyv.get(\`otp:\${id}\`);
  if (!expected) return false;
  if (String(pin) === String(expected)) {
    await keyv.delete(\`otp:\${id}\`);
    await keyv.delete(\`otp-attempts:\${id}\`);
    return true;
  }
  const attempts = ((await keyv.get(\`otp-attempts:\${id}\`)) || 0) + 1;
  if (attempts >= OTP_MAX_ATTEMPTS) {
    await keyv.delete(\`otp:\${id}\`);
    await keyv.delete(\`otp-attempts:\${id}\`);
  } else {
    await keyv.set(\`otp-attempts:\${id}\`, attempts, OTP_TTL_MS);
  }
  return false;
};`],
[`export {
  findUser,`,
`export {
  consumeOtpCode,
  setOtpCode,
  findUser,`]]);

edit("common/compiled/node/express/controller/auth/own.js", [[
`import { matchScryptHash } from '../../../auth/scrypt.js';`,
`import { matchScryptHash } from '../../../auth/scrypt.js';
import crypto from 'node:crypto';
import { consumeOtpCode, setOtpCode } from '../../../auth/keyv.js';
import { sendMail } from '../../../services/mailer.js';`],
[`    if (USE_OTP) {
      // Currently supports only Google Authenticator
      // Fido2 can be added in future
      return res.status(200).json({ otp: id });
    }`,
`    if (USE_OTP) {
      if (USE_OTP === 'EMAIL') {
        // Generate server-side, store with TTL, email it. The response carries only the user id.
        const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
        await setOtpCode(id, code);
        await sendMail({
          to: user[AUTH_USER_FIELD_LOGIN],
          subject: 'Your sign-in code',
          text: \`Your one-time sign-in code is \${code}. It expires in 5 minutes. If you did not try to sign in, ignore this email.\`,
        });
      }
      return res.status(200).json({ otp: id });
    }`],
[`      let otpOk = false;
      if (USE_OTP !== 'TEST') {`,
`      let otpOk = false;
      if (USE_OTP === 'EMAIL') {
        otpOk = await consumeOtpCode(id, pin);
      } else if (USE_OTP !== 'TEST') {`]]);

edit("common/compiled/node/express/controller/auth/oauth.js", [[
`const OAUTH_OPTIONS = globalThis.__config?.OAUTH_OPTIONS || {};`,
`const OAUTH_OPTIONS = {
  ...(globalThis.__config?.OAUTH_OPTIONS || {}),
  // Secrets belong in the environment (systemd EnvironmentFile / container env), not in a committed JSON file.
  ...(process.env.OAUTH_CLIENT_ID ? { CLIENT_ID: process.env.OAUTH_CLIENT_ID } : {}),
  ...(process.env.OAUTH_CLIENT_SECRET ? { CLIENT_SECRET: process.env.OAUTH_CLIENT_SECRET } : {}),
  ...(process.env.OAUTH_CALLBACK ? { CALLBACK: process.env.OAUTH_CALLBACK } : {}),
};`]]);

const pkgPath = path.join(root, "common/compiled/node/package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
if (!pkg.dependencies.nodemailer) { pkg.dependencies.nodemailer = "^7.0.0"; fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n"); console.log("added nodemailer dependency"); }
