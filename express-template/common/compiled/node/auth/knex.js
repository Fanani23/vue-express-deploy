let knex;
let JWT_REFRESH_STORE_NAME;
let AUTH_USER_STORE_NAME;

const setTokenService = service => (knex = service);
const setUserService = service => (knex = service);
const setRefreshTokenStoreName = name => (JWT_REFRESH_STORE_NAME = name);
const setAuthUserStoreName = name => (AUTH_USER_STORE_NAME = name);

// id field must be unique, upsert for PostgreSQL, MySQL only
const setRefreshToken = async (id, refresh_token) =>
  knex(JWT_REFRESH_STORE_NAME).insert({ id, refresh_token }).onConflict('id').merge();
const getRefreshToken = async id => (await knex(JWT_REFRESH_STORE_NAME).where({ id: id }).first()).refresh_token;
const revokeRefreshToken = async id => knex(JWT_REFRESH_STORE_NAME).where({ id: id }).delete();

const findUser = async where => knex(AUTH_USER_STORE_NAME).where(where).first();
const updateUser = async (where, payload) => knex(AUTH_USER_STORE_NAME).where(where).first().update(payload);
const NEW_ACCOUNT_ROLE = 'Viewer';
const NEW_ACCOUNT_PERMISSIONS = ['users:read', 'reports:read'];
const insertedId = rows => (typeof rows[0] === 'object' ? rows[0].id : rows[0]);
const syncSequence = async (trx, table) => {
  try {
    await trx.raw(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 0))`);
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
  });

export {
  createUser,
  findUser,
  getRefreshToken,
  revokeRefreshToken,
  setAuthUserStoreName,
  setRefreshToken,
  setRefreshTokenStoreName,
  setTokenService,
  setUserService,
  updateUser,
};
