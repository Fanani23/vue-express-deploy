import crypto from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { setScryptHash } from '../../common/compiled/node/auth/scrypt.js';

const DEFAULT_CODE = '111111';
const PASSWORD = process.env.DEMO_PASSWORD || 'Techtest123!';

const templateSeeds = ['test', 'ais-one', 'aaronjxz'];
const demoAccounts = [
  { email: 'admin@techtest.dev', username: 'admin', roles: 'Admin' },
  { email: 'demo@techtest.dev', username: 'demo', roles: 'TestGroup,Viewer' },
  { email: 'viewer@techtest.dev', username: 'viewer', roles: 'Viewer' },
];

const db = new PGlite(process.argv[2] || './db-sample/dev.db');
try {
  await db.exec("SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 0))");

  const pinned = await db.query(
    `UPDATE users SET otp_pin = $1 WHERE email = ANY($2) AND otp_pin IS NULL`,
    [DEFAULT_CODE, templateSeeds],
  );
  console.log(`  template seed users given the default code: ${pinned.affectedRows}`);

  for (const a of demoAccounts) {
    const exists = await db.query('SELECT 1 FROM users WHERE email = $1', [a.email]);
    if (exists.rows.length) {
      await db.query('UPDATE users SET otp_pin = $1 WHERE email = $2 AND otp_pin IS NULL', [DEFAULT_CODE, a.email]);
      console.log(`  ${a.email}: already present`);
      continue;
    }
    const salt = crypto.randomBytes(16).toString('hex');
    await db.query(
      `INSERT INTO users (roles, tenant_id, username, email, salt, password, "gaKey", revoked, "refreshToken", otp_pin)
       VALUES ($1, 1, $2, $3, $4, $5, '', '', '', $6)`,
      [a.roles, a.username, a.email, salt, await setScryptHash(PASSWORD, salt), DEFAULT_CODE],
    );
    console.log(`  ${a.email}: created (${a.roles})`);
  }
} finally {
  await db.close();
}
