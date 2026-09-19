const fs = require("fs"), path = require("path");
const root = process.argv[2];
const f = path.join(root, "common/compiled/node/express/controller/auth/oauth.js");
let s = fs.readFileSync(f, "utf8");
if (s.includes("auto-provision")) { console.log("already patched oauth.js"); process.exit(0); }

const before = `      const user = await authFns.findUser({ [OAUTH_OPTIONS.FIND_ID]: oauthId }); // match github id (or email?) with our user in our application
      if (!user) return res.status(401).json({ message: 'Unauthorized' });`;
const after = `      let user = await authFns.findUser({ [OAUTH_OPTIONS.FIND_ID]: oauthId }); // match github id with our user
      if (!user) {
        // auto-provision: GitHub has verified the email, so link an existing account by email or create one.
        const email = await primaryEmail(oauthUser, data.access_token);
        if (!email) return res.status(401).json({ message: 'GitHub account has no verified email' });
        user = await authFns.findUser({ email });
        if (user) {
          await authFns.updateUser({ id: user.id }, { [OAUTH_OPTIONS.FIND_ID]: oauthId });
        } else {
          const id = await authFns.createUser({
            email,
            username: oauthUser.login || email.split('@')[0],
            [OAUTH_OPTIONS.FIND_ID]: oauthId,
            tenant_id: Number(process.env.SIGNUP_DEFAULT_TENANT || 1),
            salt: '',
            password: '', // no password: this account signs in with GitHub only
            revoked: '',
            refreshToken: '',
          });
          user = await authFns.findUser({ id });
        }
      }`;
if (!s.includes(before)) { console.error("pattern not found in oauth.js"); process.exit(1); }
s = s.replace(before, after);

s = s.replace(`// /callback
export const callbackOAuth = async (req, res) => {`,
`const primaryEmail = async (oauthUser, token) => {
  if (oauthUser.email) return String(oauthUser.email).toLowerCase();
  try {
    const r = await fetch('https://api.github.com/user/emails', { headers: { Authorization: \`token \${token}\` } });
    const list = await r.json();
    const primary = Array.isArray(list) ? list.find(e => e.primary && e.verified) || list.find(e => e.verified) : null;
    return primary ? String(primary.email).toLowerCase() : null;
  } catch {
    return null;
  }
};

// /callback
export const callbackOAuth = async (req, res) => {`);
if (!s.includes("const primaryEmail")) { console.error("callback marker not found in oauth.js"); process.exit(1); }
fs.writeFileSync(f, s);
console.log("patched common/compiled/node/express/controller/auth/oauth.js (auto-provision)");
