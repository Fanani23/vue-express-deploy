const fs = require("fs"), path = require("path");
const root = process.argv[2];
const edit = (rel, marker, pairs, { optional = false } = {}) => {
  const f = path.join(root, rel); let s = fs.readFileSync(f, "utf8");
  if (marker && s.includes(marker)) { console.log("already patched " + rel); return; }
  let n = 0;
  for (const [a, b] of pairs) {
    if (!s.includes(a)) { if (optional) continue; console.error(`MISSING in ${rel}: ${a.slice(0, 60)}`); process.exit(1); }
    s = s.split(a).join(b); n++;
  }
  if (n) { fs.writeFileSync(f, s); console.log("patched " + rel); }
};

edit("common/compiled/node/auth/knex.js", "NEW_ACCOUNT_ROLE", [[
`const createUser = async payload => {
  // Seeds insert explicit ids, which leaves the serial sequence behind. Postgres/PGlite only; harmless elsewhere.
  try {
    await knex.raw(\`SELECT setval(pg_get_serial_sequence('\${AUTH_USER_STORE_NAME}', 'id'), COALESCE((SELECT MAX(id) FROM \${AUTH_USER_STORE_NAME}), 0))\`);
  } catch {
    /* non-Postgres store */
  }
  const [row] = await knex(AUTH_USER_STORE_NAME).insert(payload).returning('id');
  return typeof row === 'object' ? row.id : row;
};`,
`const NEW_ACCOUNT_ROLE = 'Viewer';
const NEW_ACCOUNT_PERMISSIONS = ['users:read', 'reports:read'];
const insertedId = rows => (typeof rows[0] === 'object' ? rows[0].id : rows[0]);
const syncSequence = async (trx, table) => {
  try {
    await trx.raw(\`SELECT setval(pg_get_serial_sequence('\${table}', 'id'), COALESCE((SELECT MAX(id) FROM \${table}), 0))\`);
  } catch {
    return;
  }
};
const createUser = async payload =>
  knex.transaction(async trx => {
    const tenantId = Number(payload.tenant_id ?? 1);
    await syncSequence(trx, AUTH_USER_STORE_NAME);
    const id = insertedId(await trx(AUTH_USER_STORE_NAME).insert({ ...payload, roles: NEW_ACCOUNT_ROLE, tenant_id: tenantId }).returning('id'));
    let role = await trx('roles').where({ tenant_id: tenantId, name: NEW_ACCOUNT_ROLE }).first();
    if (!role) {
      await syncSequence(trx, 'roles');
      role = { id: insertedId(await trx('roles').insert({ tenant_id: tenantId, name: NEW_ACCOUNT_ROLE, description: 'Read-only access' }).returning('id')) };
      for (const name of NEW_ACCOUNT_PERMISSIONS) {
        let permission = await trx('permissions').where({ name }).first();
        if (!permission) {
          await syncSequence(trx, 'permissions');
          permission = { id: insertedId(await trx('permissions').insert({ name, description: name }).returning('id')) };
        }
        await trx('role_permissions').insert({ role_id: role.id, permission_id: permission.id });
      }
    }
    await trx('user_tenant_roles').insert({ user_id: id, tenant_id: tenantId, role_id: role.id });
    return id;
  });`]]);

edit("common/compiled/node/express/controller/auth/own.js", null, [
[`const SIGNUP_DEFAULT_ROLE = process.env.SIGNUP_DEFAULT_ROLE || 'TestGroup';\n`, ``],
[`      roles: SIGNUP_DEFAULT_ROLE,\n`, ``]], { optional: true });

edit("common/compiled/node/express/controller/auth/oauth.js", null, [
[`            roles: process.env.SIGNUP_DEFAULT_ROLE || 'TestGroup',\n`, ``]], { optional: true });
