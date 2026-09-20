import crypto from 'node:crypto';
import { authFns, createToken, setTokensToHeader, tokensForClient } from '../../../auth/index.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

const cfg = () => ({
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  callback: process.env.GOOGLE_CALLBACK || 'http://127.0.0.1:3000/api/google/callback',
  spaCallback: process.env.OAUTH_CALLBACK || globalThis.__config?.OAUTH_OPTIONS?.CALLBACK || '/callback',
});

export const enabled = () => {
  const { clientId, clientSecret } = cfg();
  return clientId.length > 10 && clientSecret.length > 10;
};

const STATE_COOKIE = 'g_state';

export const login = (req, res) => {
  if (!enabled()) return res.status(404).json({ message: 'Google sign-in is not configured' });
  const { clientId, callback } = cfg();
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(STATE_COOKIE, state, { httpOnly: true, sameSite: 'lax', maxAge: 10 * 60 * 1000 });
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callback,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
    state,
  });
  return res.redirect(`${AUTH_URL}?${q}`);
};

export const callback = async (req, res) => {
  const { clientId, clientSecret, callback: redirectUri, spaCallback } = cfg();
  try {
    const { code, state, error } = req.query;
    if (error) return res.status(401).json({ message: `Google: ${error}` });
    if (!code || !state || state !== req.cookies?.[STATE_COOKIE]) {
      return res.status(401).json({ message: 'Invalid OAuth state' });
    }
    res.clearCookie(STATE_COOKIE);

    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    const tokens = await tokenRes.json();
    if (!tokens.id_token) return res.status(401).json({ message: 'Google did not return an ID token' });

    const infoRes = await fetch(`${TOKENINFO_URL}?id_token=${encodeURIComponent(tokens.id_token)}`);
    const info = await infoRes.json();
    if (info.aud !== clientId || info.email_verified !== 'true' || !info.email) {
      return res.status(401).json({ message: 'Google identity could not be verified' });
    }
    const email = String(info.email).toLowerCase();

    let user = await authFns.findUser({ email });
    if (!user) {
      const id = await authFns.createUser({
        email,
        username: info.name || email.split('@')[0],
        roles: process.env.SIGNUP_DEFAULT_ROLE || 'TestGroup',
        tenant_id: Number(process.env.SIGNUP_DEFAULT_TENANT || 1),
        salt: '',
        password: '',
        revoked: '',
        refreshToken: '',
      });
      user = await authFns.findUser({ id });
    }
    if (user.revoked) return res.status(401).json({ message: 'Revoked credentials' });

    const ours = await createToken(user);
    setTokensToHeader(res, ours); // HttpOnly cookies when COOKIE_HTTPONLY; the hash then carries the access token only
    const safe = tokensForClient(ours);
    return res.redirect(`${spaCallback}#${safe.access_token};${safe.refresh_token || ''};${JSON.stringify(safe.user_meta)}`);
  } catch (e) {
    globalThis.logger?.info?.('google auth err', e.toString());
    return res.status(401).json({ message: 'NOT Authenticated' });
  }
};
