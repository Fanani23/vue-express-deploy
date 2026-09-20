// /api/users - the accounts behind the portal's "Team members", as a real resource on the template's `users` table.
// Installed by patches/0016-users-endpoint.js as apps/sample-api/src/routes/users.js.
//
//   GET    /api/users          any signed-in user   list (never password, salt, gaKey or otp_pin)
//   GET    /api/users/me       any signed-in user   the caller's own row
//   POST   /api/users          Admin                { email, username?, roles?, password?, otpPin? }
//                                                   201 { user, temporaryPassword? } - the password is shown once
//   PUT    /api/users/:id      Admin                { username?, roles?, revoked?, unlock? } - not your own Admin role/revoke
//   DELETE /api/users/:id      Admin                not yourself; the refresh token is revoked too
import crypto from 'node:crypto';
import express from 'express';
import { authFns, authUser } from '@common/node/auth';
import { setScryptHash } from '@common/node/auth/scrypt';
import * as s from '@common/node/services';
import { clearLockout, lockedUntil } from '@common/node/auth/keyv';

const TABLE = process.env.AUTH_USER_STORE_NAME || 'users';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ROLE_RE = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/;
const USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}$/;
const DEFAULT_ROLE = process.env.SIGNUP_DEFAULT_ROLE || 'Viewer';
const PUBLIC = ['id', 'username', 'email', 'roles', 'revoked', 'tenant_id'];

const knex = () => s.get('knex1');
const isAdmin = req => req.rbac?.hasRole('Admin');
const toPublic = row => ({
  id: row.id,
  username: row.username || row.email.split('@')[0],
  email: row.email,
  roles: String(row.roles ?? '').split(',').map(r => r.trim()).filter(Boolean),
  revoked: !!row.revoked,
  tenantId: row.tenant_id ?? null,
});
const parseRoles = input => {
  const list = Array.isArray(input) ? input : String(input ?? '').split(',');
  const roles = [...new Set(list.map(r => String(r).trim()).filter(Boolean))];
  if (!roles.every(r => ROLE_RE.test(r))) return null;
  return roles;
};
const adminOnly = (req, res, next) => (isAdmin(req) ? next() : res.status(403).json({ message: 'Admin role required' }));

// `lockedUntil` comes from the session store (patch 0019), one lookup per account.
const withLock = async row => ({ ...toPublic(row), lockedUntil: await lockedUntil(row.id).then(u => (u ? new Date(u).toISOString() : null)) });

const list = async (req, res) => {
  const rows = await knex()(TABLE).select(PUBLIC).orderBy('id');
  return res.status(200).json(await Promise.all(rows.map(withLock)));
};

const me = async (req, res) => {
  const row = await knex()(TABLE).select(PUBLIC).where({ id: req.user.sub }).first();
  return row ? res.status(200).json(toPublic(row)) : res.status(404).json({ message: 'Not found' });
};

const create = async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ message: 'A valid email address is required' });
  const username = String(req.body?.username ?? email.split('@')[0]).trim();
  if (!USERNAME_RE.test(username)) return res.status(400).json({ message: 'Username: letters, digits, space . _ - (max 64)' });
  const roles = parseRoles(req.body?.roles ?? DEFAULT_ROLE);
  if (!roles || roles.length === 0) return res.status(400).json({ message: 'Roles: letters, digits, _ - (max 32 each)' });
  let password = req.body?.password == null ? null : String(req.body.password);
  let temporaryPassword;
  if (password === null) {
    temporaryPassword = crypto.randomBytes(18).toString('base64url');
    password = temporaryPassword;
  } else if (password.length < 10 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password) || new Set(password).size < 4) {
    return res.status(400).json({ message: 'Password must be at least 10 characters with letters and digits' });
  }
  const otpPin = req.body?.otpPin == null || req.body.otpPin === '' ? null : String(req.body.otpPin);
  if (otpPin !== null && !/^\d{6}$/.test(otpPin)) return res.status(400).json({ message: 'otpPin must be 6 digits' });
  if (await authFns.findUser({ email })) return res.status(409).json({ message: 'An account with this email already exists' });

  const salt = crypto.randomBytes(16).toString('hex');
  try {
    const id = await authFns.createUser({
      email,
      username,
      roles: roles.join(','),
      salt,
      password: await setScryptHash(password, salt),
      gaKey: crypto.randomBytes(10).toString('hex'),
      tenant_id: req.user.tenant_id ?? null,
      revoked: '',
      refreshToken: '',
      otp_pin: otpPin,
    });
    const row = await knex()(TABLE).select(PUBLIC).where({ id }).first();
    return res.status(201).json({ user: toPublic(row), ...(temporaryPassword && { temporaryPassword }) });
  } catch (e) {
    if (/unique/i.test(String(e?.message))) return res.status(409).json({ message: 'An account with this email already exists' });
    throw e;
  }
};

const update = async (req, res) => {
  const id = Number(req.params.id);
  const row = await knex()(TABLE).select(PUBLIC).where({ id }).first();
  if (!row) return res.status(404).json({ message: 'Not found' });
  const self = String(req.user.sub) === String(id);
  const patch = {};
  if (req.body?.username != null) {
    const username = String(req.body.username).trim();
    if (!USERNAME_RE.test(username)) return res.status(400).json({ message: 'Username: letters, digits, space . _ - (max 64)' });
    patch.username = username;
  }
  if (req.body?.roles != null) {
    const roles = parseRoles(req.body.roles);
    if (!roles || roles.length === 0) return res.status(400).json({ message: 'Roles: letters, digits, _ - (max 32 each)' });
    if (self && !roles.includes('Admin')) return res.status(400).json({ message: 'You cannot remove your own Admin role' });
    patch.roles = roles.join(',');
  }
  if (req.body?.revoked != null) {
    if (self && req.body.revoked) return res.status(400).json({ message: 'You cannot revoke yourself' });
    patch.revoked = req.body.revoked ? new Date().toISOString() : '';
  }
  let unlocked = false;
  if (req.body?.unlock) { await clearLockout(id); unlocked = true; }
  if (Object.keys(patch).length === 0 && !unlocked) return res.status(400).json({ message: 'Nothing to update' });
  if (Object.keys(patch).length === 0) return res.status(200).json(await withLock(row));
  await knex()(TABLE).where({ id }).update(patch);
  if (patch.revoked) await authFns.revokeRefreshToken(String(id)); // a revoked account cannot refresh its session
  const updated = await knex()(TABLE).select(PUBLIC).where({ id }).first();
  return res.status(200).json(await withLock(updated));
};

const remove = async (req, res) => {
  const id = Number(req.params.id);
  if (String(req.user.sub) === String(id)) return res.status(400).json({ message: 'You cannot delete yourself' });
  const count = await knex()(TABLE).where({ id }).delete();
  if (!count) return res.status(404).json({ message: 'Not found' });
  await authFns.revokeRefreshToken(String(id));
  return res.status(204).end();
};

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);
// Express 5 (path-to-regexp 8) has no inline param patterns, so the numeric check is explicit.
const numericId = (req, res, next) => (/^\d+$/.test(req.params.id) ? next() : res.status(404).json({ message: 'Not found' }));

export default express
  .Router()
  .get('/', authUser, wrap(list))
  .get('/me', authUser, wrap(me))
  .post('/', authUser, adminOnly, wrap(create))
  .put('/:id', numericId, authUser, adminOnly, wrap(update))
  .delete('/:id', numericId, authUser, adminOnly, wrap(remove));
