// own authentication
import jwt from 'jsonwebtoken';
import { generateSecret, verify } from 'otplib';

import { authFns, createToken, getSecret, setTokensToHeader } from '../../../auth/index.js';
import { matchScryptHash, setScryptHash } from '../../../auth/scrypt.js';
import crypto from 'node:crypto';
import { consumeOtpCode, setOtpCode } from '../../../auth/keyv.js';
import { sendMail } from '../../../services/mailer.js';

const { COOKIE_HTTPONLY, JWT_ALG } = globalThis.__config.JWT;

const {
  AUTH_USER_FIELD_LOGIN,
  AUTH_USER_FIELD_SALT,
  AUTH_USER_FIELD_PASSWORD,
  AUTH_USER_FIELD_GAKEY,
  AUTH_USER_FIELD_ID_FOR_JWT,
  USE_OTP,
} = process.env;

const logout = async (req, res) => {
  let id = null;
  try {
    let access_token = null;
    const tmp = req.cookies?.Authorization || req.header('Authorization') || req.query?.Authorization;
    access_token = tmp.split(' ')[1];
    const user = jwt.decode(access_token);
    id = user.sub;
    jwt.verify(access_token, getSecret('verify'), { algorithm: [JWT_ALG] }); // throw if expired or invalid
  } catch (e) {
    if (e.name !== 'TokenExpiredError') id = null;
  }
  try {
    if (id) {
      await authFns.revokeRefreshToken(id); // clear
      if (COOKIE_HTTPONLY) {
        res.clearCookie('refresh_token');
        res.clearCookie('Authorization');
      }
      return res.status(200).json({ message: 'Logged Out' });
    }
  } catch (e) {
    logger.info('logout err', e.toString());
  }
  return res.status(500).json();
};

const refresh = async (req, res) => {
  // refresh logic all done in authUser
  return res.status(401).json({ message: 'Error token revoked' });
};

const login = async (req, res) => {
  try {
    const user = await authFns.findUser({
      [AUTH_USER_FIELD_LOGIN]: req.body[AUTH_USER_FIELD_LOGIN],
    });
    if (!user) return res.status(401).json({ message: 'Incorrect credentials...1' });
    // console.log(req.body[AUTH_USER_FIELD_PASSWORD]);
    // console.log(user[AUTH_USER_FIELD_SALT]);
    // console.log(user[AUTH_USER_FIELD_PASSWORD]);
    if (
      !(await matchScryptHash(
        req.body[AUTH_USER_FIELD_PASSWORD],
        user[AUTH_USER_FIELD_SALT],
        user[AUTH_USER_FIELD_PASSWORD],
      ))
    ) {
      return res.status(401).json({ message: 'Incorrect credentials...2' });
    }
    if (user.revoked) return res.status(401).json({ message: 'Revoked credentials' });
    const id = user[AUTH_USER_FIELD_ID_FOR_JWT];
    if (!id) return res.status(401).json({ message: 'Authorization Format Error' });
    if (USE_OTP) {
      if (user.otp_pin) return res.status(200).json({ otp: id, fixed: true });
      if (USE_OTP === 'EMAIL') {
        // Generate server-side, store with TTL, email it. The response carries only the user id.
        const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
        await setOtpCode(id, code);
        await sendMail({
          to: user[AUTH_USER_FIELD_LOGIN],
          subject: 'Your sign-in code',
          text: `Your one-time sign-in code is ${code}. It expires in 5 minutes. If you did not try to sign in, ignore this email.`,
        });
      }
      return res.status(200).json({ otp: id });
    }
    const tokens = await createToken(user); // 5 minute expire for login
    setTokensToHeader(res, tokens);
    return res.status(200).json(tokens);
  } catch (e) {
    // logger.info('login err', e.toString())
  }
  return res.status(500).json();
};

const otp = async (req, res) => {
  // need to be authentication, body { id: '', pin: '123456' }
  try {
    const { id, pin } = req.body;
    const user = await authFns.findUser({ id });
    if (user) {
      const gaKey = user[AUTH_USER_FIELD_GAKEY];
      // otplib >= 13: verify() is async and resolves to { valid }. Without await the Promise is
      // always truthy and ANY pin would be accepted in GA mode. Malformed pins throw -> treat as invalid.
      let otpOk = false;
      if (user.otp_pin) {
        otpOk = String(pin) === String(user.otp_pin);
      } else if (USE_OTP === 'EMAIL') {
        otpOk = await consumeOtpCode(id, pin);
      } else if (USE_OTP !== 'TEST') {
        try {
          otpOk = (await verify({ token: String(pin), secret: gaKey })).valid === true;
        } catch {
          otpOk = false;
        }
      } else {
        otpOk = String(pin) === '111111';
      }
      if (otpOk) {
        // NOTE: expiry will be determined by authenticator itself
        const tokens = await createToken(user);
        setTokensToHeader(res, tokens);
        return res.status(200).json(tokens);
      } else {
        return res.status(401).json({ message: 'Error token wrong pin' });
      }
    }
  } catch (e) {
    logger.info('otp err', e.toString());
  }
  return res.status(401).json({ message: 'Error token revoked' });
};

const SIGNUP_DEFAULT_TENANT = Number(process.env.SIGNUP_DEFAULT_TENANT || 1);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
        text: `Welcome! Your verification code is ${code}. It expires in 5 minutes.`,
      });
      return res.status(201).json({ otp: id });
    }
    if (USE_OTP) {
      // GA / TEST: the client needs to enrol the new secret; hand back the otpauth URI once.
      const issuer = encodeURIComponent(process.env.OTP_ISSUER || 'Tech Lead Portal');
      const totpUri = `otpauth://totp/${issuer}:${encodeURIComponent(email)}?secret=${gaKey}&issuer=${issuer}`;
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

export { login, logout, otp, refresh, signup };
