import { authFns, createToken, setTokensToHeader } from '../../../auth/index.js';

const { AUTH_ERROR_URL } = globalThis.__config;
const OAUTH_OPTIONS = {
  ...(globalThis.__config?.OAUTH_OPTIONS || {}),
  // Secrets belong in the environment (systemd EnvironmentFile / container env), not in a committed JSON file.
  ...(process.env.OAUTH_CLIENT_ID ? { CLIENT_ID: process.env.OAUTH_CLIENT_ID } : {}),
  ...(process.env.OAUTH_CLIENT_SECRET ? { CLIENT_SECRET: process.env.OAUTH_CLIENT_SECRET } : {}),
  ...(process.env.OAUTH_CALLBACK ? { CALLBACK: process.env.OAUTH_CALLBACK } : {}),
};
// set callback URL on github to <schema://host:port>/api/oauth/callback
// initiated from browser - window.location.replace('https://github.com/login/oauth/authorize?scope=user:email&client_id=XXXXXXXXXXXXXXXXXXXX')

const primaryEmail = async (oauthUser, token) => {
  if (oauthUser.email) return String(oauthUser.email).toLowerCase();
  try {
    const r = await fetch('https://api.github.com/user/emails', { headers: { Authorization: `token ${token}` } });
    const list = await r.json();
    const primary = Array.isArray(list) ? list.find(e => e.primary && e.verified) || list.find(e => e.verified) : null;
    return primary ? String(primary.email).toLowerCase() : null;
  } catch {
    return null;
  }
};

// /callback
export const callbackOAuth = async (req, res) => {
  try {
    const { code, state } = req.query;
    const result = await fetch(OAUTH_OPTIONS.URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: OAUTH_OPTIONS.CLIENT_ID,
        client_secret: OAUTH_OPTIONS.CLIENT_SECRET,
        code,
        state,
      }),
    });
    const data = await result.json();
    if (data.access_token) {
      const resultUser = await fetch(OAUTH_OPTIONS.USER_URL, {
        method: 'GET',
        headers: { Authorization: `token ${data.access_token}` },
      });
      const oauthUser = await resultUser.json();
      const oauthId = oauthUser[OAUTH_OPTIONS.USER_ID]; // github id, email

      let user = await authFns.findUser({ [OAUTH_OPTIONS.FIND_ID]: oauthId }); // match github id with our user
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
      }

      const { id, roles } = user;
      const tokens = await createToken({ sub: id, roles: roles.split(',') });
      setTokensToHeader(res, tokens);
      return res.redirect(
        `${OAUTH_OPTIONS.CALLBACK}#${tokens.access_token};${tokens.refresh_token};${JSON.stringify(tokens.user_meta)}`,
      ); // use url fragment...
    }
    return res.status(401).json({ message: 'Missing Token' });
  } catch (e) {
    return AUTH_ERROR_URL ? res.redirect(AUTH_ERROR_URL) : res.status(401).json({ error: 'NOT Authenticated' });
  }
};
