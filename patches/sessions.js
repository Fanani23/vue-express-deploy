// The signed-in user's devices - installed by patches/0020-sessions-per-device.js as routes/sessions.js.
//   GET    /api/auth/sessions        [{ key, device, ip, createdAt, lastSeen, current }]  (tokens never leave the server;
//                                    `current` is the session whose key is the access token's `sid` claim)
//   DELETE /api/auth/sessions/:key   sign that device out (its refresh token is dropped); 404 unknown key
import crypto from 'node:crypto';
import express from 'express';
import { authUser } from '@common/node/auth';
import { listSessions, revokeSession } from '@common/node/auth/keyv';

// A stable, non-secret handle for a session: the first 12 hex chars of the token's SHA-256.
const keyOf = token => crypto.createHash('sha256').update(String(token)).digest('hex').slice(0, 12);

const list = async (req, res) => {
  const sessions = (await listSessions(req.user.sub)).map(s => ({
    key: keyOf(s.token),
    device: s.device,
    ip: s.ip,
    createdAt: s.at ? new Date(s.at).toISOString() : null,
    lastSeen: s.seen ? new Date(s.seen).toISOString() : null,
    current: keyOf(s.token) === req.user.sid,
  }));
  return res.status(200).json(sessions.sort((a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || '')));
};

const remove = async (req, res) => {
  const target = (await listSessions(req.user.sub)).find(s => keyOf(s.token) === req.params.key);
  if (!target) return res.status(404).json({ message: 'No such session' });
  await revokeSession(req.user.sub, target.token);
  return res.status(204).end();
};

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

export default express
  .Router()
  .get('/sessions', authUser, wrap(list))
  .delete('/sessions/:key', authUser, wrap(remove));
