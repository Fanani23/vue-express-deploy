const fs = require("fs"), path = require("path");
const root = process.argv[2];
const edit = (rel, marker, pairs) => {
  const f = path.join(root, rel); let s = fs.readFileSync(f, "utf8");
  if (s.includes(marker)) { console.log("already patched " + rel); return; }
  for (const [a, b] of pairs) { if (!s.includes(a)) { console.error(`MISSING in ${rel}: ${a.slice(0, 60)}`); process.exit(1); } s = s.replace(a, b); }
  fs.writeFileSync(f, s); console.log("patched " + rel);
};

edit("common/compiled/node/auth/knex.js", "const createUser", [[
`const updateUser = async (where, payload) => knex(AUTH_USER_STORE_NAME).where(where).first().update(payload);`,
`const updateUser = async (where, payload) => knex(AUTH_USER_STORE_NAME).where(where).first().update(payload);
const createUser = async payload => {
  // Seeds insert explicit ids, which leaves the serial sequence behind. Postgres/PGlite only; harmless elsewhere.
  try {
    await knex.raw(\`SELECT setval(pg_get_serial_sequence('\${AUTH_USER_STORE_NAME}', 'id'), COALESCE((SELECT MAX(id) FROM \${AUTH_USER_STORE_NAME}), 0))\`);
  } catch {
    /* non-Postgres store */
  }
  const [row] = await knex(AUTH_USER_STORE_NAME).insert(payload).returning('id');
  return typeof row === 'object' ? row.id : row;
};`],
[`export {
  findUser,`,
`export {
  createUser,
  findUser,`]]);

edit("common/compiled/node/auth/index.js", "createUser: authFns.createUser", [[
`const authFns = {
  findUser: null,
  updateUser: null,`,
`const authFns = {
  createUser: null,
  findUser: null,
  updateUser: null,`],
[`    findUser: authFns.findUser,
    updateUser: authFns.updateUser,`,
`    createUser: authFns.createUser,
    findUser: authFns.findUser,
    updateUser: authFns.updateUser,`]]);

edit("common/compiled/node/express/controller/auth/own.js", "const signup = async", [[
`import { verify } from 'otplib';`,
`import { generateSecret, verify } from 'otplib';`],
[`import { matchScryptHash } from '../../../auth/scrypt.js';`,
`import { matchScryptHash, setScryptHash } from '../../../auth/scrypt.js';`],
[`export { login, logout, otp, refresh };`,
`const SIGNUP_DEFAULT_TENANT = Number(process.env.SIGNUP_DEFAULT_TENANT || 1);
const EMAIL_RE = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;

const signup = async (req, res) => {
  try {
    const email = String(req.body?.[AUTH_USER_FIELD_LOGIN] ?? req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.[AUTH_USER_FIELD_PASSWORD] ?? req.body?.password ?? '');
    if (!EMAIL_RE.test(email)) return res.status(400).json({ message: 'A valid email address is required' });
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
    if (await authFns.findUser({ [AUTH_USER_FIELD_LOGIN]: email })) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const gaKey = generateSecret();
    const id = await authFns.createUser({
      [AUTH_USER_FIELD_LOGIN]: email,
      username: email.split('@')[0],
      roles: process.env.SIGNUP_DEFAULT_ROLE || 'TestGroup',
      [AUTH_USER_FIELD_SALT]: salt,
      [AUTH_USER_FIELD_PASSWORD]: await setScryptHash(password, salt),
      [AUTH_USER_FIELD_GAKEY]: gaKey,
      tenant_id: SIGNUP_DEFAULT_TENANT,
      revoked: '',
      refreshToken: '',
    });

    if (USE_OTP === 'EMAIL') {
      // Verify the mailbox before the first token is ever issued — same step as login.
      const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
      await setOtpCode(id, code);
      await sendMail({
        to: email,
        subject: 'Confirm your email address',
        text: \`Welcome! Your verification code is \${code}. It expires in 5 minutes.\`,
      });
      return res.status(201).json({ otp: id });
    }
    if (USE_OTP) {
      // GA / TEST: the client needs to enrol the new secret; hand back the otpauth URI once.
      const issuer = encodeURIComponent(process.env.OTP_ISSUER || 'Tech Lead Portal');
      const totpUri = \`otpauth://totp/\${issuer}:\${encodeURIComponent(email)}?secret=\${gaKey}&issuer=\${issuer}\`;
      return res.status(201).json({ otp: id, totpUri });
    }
    const user = await authFns.findUser({ id });
    const tokens = await createToken(user);
    setTokensToHeader(res, tokens);
    return res.status(201).json(tokens);
  } catch (e) {
    if (/unique/i.test(String(e?.message))) return res.status(409).json({ message: 'An account with this email already exists' });
    logger.info('signup err', e.toString());
  }
  return res.status(500).json({ message: 'Sign-up failed' });
};

export { login, logout, otp, refresh, signup };`]]);

edit("apps/sample-api/src/routes/auth.js", "own.signup", [[
`  .post('/signup', (req, res) => {
    // TODO
    res.status(201).end();
  });`,
`  .post('/signup', own.signup);`]]);
