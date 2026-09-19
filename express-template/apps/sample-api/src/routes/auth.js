import * as auth from '@common/node/auth';
import { oauth, oidc, own, saml } from '@common/node/express/controller/auth';
import * as google from '@common/node/express/controller/auth/google';
import express from 'express';

export const myauthRoute = express
  .Router()
  .post('/login', own.login)
  .post('/otp', own.otp)
  .post('/refresh', auth.authRefresh)
  .get('/logout', own.logout)
  .get('/verify', auth.authUser, async (req, res) => res.json({}))
  .get('/me', auth.authUser, (req, res) => {
    const { sub } = req.user;
    // you can also get more user information from here from a datastore
    return res.status(200).json({ user: sub, ts: Date.now() });
  })
  .post('/signup', own.signup)
  .get('/providers', (req, res) => {
    const o = globalThis.__config?.OAUTH_OPTIONS || {};
    const id = process.env.OAUTH_CLIENT_ID || o.CLIENT_ID || '';
    const secret = process.env.OAUTH_CLIENT_SECRET || o.CLIENT_SECRET || '';
    const usable = v => typeof v === 'string' && v.length >= 10 && !v.includes('<'); // '<REDACTED>' placeholder = unset
    res.json({
      github: usable(id) && usable(secret),
      google: google.enabled(),
      githubClientId: usable(id) ? id : '',
      otp: process.env.USE_OTP || '',
    });
  });

export const oauthRoute = express.Router().get('/callback', oauth.callbackOAuth);
export const googleRoute = express.Router().get('/login', google.login).get('/callback', google.callback);

export const oidcRoute = express
  .Router()
  .get('/login', oidc.login)
  .get('/auth', oidc.auth)
  .get('/refresh', oidc.refresh);

export const samlRoute = express.Router().get('/login', saml.login).post('/callback', saml.auth);
