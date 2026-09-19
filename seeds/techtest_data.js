import crypto from 'node:crypto';
import { setScryptHash } from '../../../../common/compiled/node/auth/scrypt.js';

const GA_KEY = 'IZDXCUDYNQ4ESMZZNY4HGZSDJRAVGZCO';
const PASSWORD = 'Techtest123!';

const ACCOUNTS = [
  { username: 'admin',  email: 'admin@techtest.dev',  roles: ['Admin'] },
  { username: 'demo',   email: 'demo@techtest.dev',   roles: ['TestGroup', 'Viewer'] },
  { username: 'viewer', email: 'viewer@techtest.dev', roles: ['Viewer'] },
];

const ROLES = [
  { name: 'Admin',  description: 'Full access', permissions: ['users:read', 'users:write', 'reports:read', 'reports:export'] },
  { name: 'Viewer', description: 'Read-only',   permissions: ['users:read', 'reports:read'] },
];

const SUBJECTS = [
  { code: 'BIO',  name: 'Biology',          passingGrade: 45 },
  { code: 'CS',   name: 'Computer Science', passingGrade: 50 },
  { code: 'HIST', name: 'History',          passingGrade: 40 },
];

const AWARDS = [{ code: 'ld', name: 'Leadership' }];

const STUDENTS = [
  ['Adi',     'Nugroho',   'M', 'ID'], ['Bunga',   'Lestari',   'F', 'ID'], ['Citra',   'Dewi',      'F', 'ID'],
  ['Dimas',   'Prasetyo',  'M', 'ID'], ['Eka',     'Wijaya',    'F', 'ID'], ['Fajar',   'Ramadhan',  'M', 'ID'],
  ['Gita',    'Permata',   'F', 'ID'], ['Hendra',  'Saputra',   'M', 'ID'], ['Indah',   'Sari',      'F', 'ID'],
  ['Joko',    'Susilo',    'M', 'ID'], ['Kartika', 'Putri',     'F', 'SG'], ['Lukman',  'Hakim',     'M', 'SG'],
  ['Maya',    'Anggraini', 'F', 'SG'], ['Nanda',   'Pratama',   'M', 'MY'], ['Oktavia', 'Rahayu',    'F', 'MY'],
  ['Putra',   'Setiawan',  'M', 'ID'], ['Rina',    'Kusuma',    'F', 'ID'], ['Surya',   'Darma',     'M', 'ID'],
  ['Tania',   'Maharani',  'F', 'SG'], ['Yoga',    'Firmansyah','M', 'ID'],
];

const GRADES = ['A', 'A', 'B', 'B', 'B', 'C', 'C', 'D'];

export async function seed(knex) {
  const marker = await knex('users').where({ email: ACCOUNTS[0].email }).first('id');
  if (marker) {
    console.log('seed: techtest data already present, skipping');
    return;
  }

  await knex.transaction(async (trx) => {
    for (const [table, column] of [['users', 'id'], ['roles', 'id'], ['student', 'id']]) {
      await trx.raw(`select setval(pg_get_serial_sequence('${table}', '${column}'), coalesce((select max("${column}") from "${table}"), 0) + 1, false)`);
    }

    const permissions = Object.fromEntries((await trx('permissions').select('id', 'name')).map((p) => [p.name, p.id]));
    const roleIds = Object.fromEntries((await trx('roles').where({ tenant_id: 1 }).select('id', 'name')).map((r) => [r.name, r.id]));
    for (const role of ROLES) {
      const [row] = await trx('roles').insert({ tenant_id: 1, name: role.name, description: role.description }).returning('id');
      roleIds[role.name] = row.id ?? row;
      await trx('role_permissions').insert(role.permissions.map((p) => ({ role_id: roleIds[role.name], permission_id: permissions[p] })));
    }

    for (const account of ACCOUNTS) {
      const salt = crypto.randomBytes(16).toString('hex');
      const [row] = await trx('users')
        .insert({
          roles: account.roles.join(','),
          tenant_id: 1,
          username: account.username,
          email: account.email,
          githubId: null,
          salt,
          password: await setScryptHash(PASSWORD, salt),
          gaKey: GA_KEY,
          sms: '',
          smsVerified: 0,
          telegramId: '',
          telegramUsername: '',
          revoked: '',
          refreshToken: '',
        })
        .returning('id');
      const userId = row.id ?? row;
      await trx('user_tenant_roles').insert(account.roles.map((r) => ({ user_id: userId, tenant_id: 1, role_id: roleIds[r] })));
    }

    await trx('subject').insert(SUBJECTS);
    await trx('award').insert(AWARDS);

    const now = new Date().toISOString();
    const inserted = await trx('student')
      .insert(
        STUDENTS.map(([firstName, lastName, sex, country], i) => ({
          firstName,
          lastName,
          avatar: '',
          kyc: '',
          awards: i % 4 === 0 ? 'ac' : i % 7 === 0 ? 'ld' : '',
          sex,
          age: 16 + (i % 4),
          gpa: (2.5 + ((i * 7) % 15) / 10).toFixed(2),
          birthDate: `${2008 + (i % 3)}-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 27)).padStart(2, '0')}`,
          birthTime: '0800',
          country,
          state: '',
          dateTimeTz: now,
          secret: '',
          remarks: '',
          updated_by: 'seed',
          updated_at: now,
        })),
      )
      .returning('id');

    const subjectCodes = (await trx('subject').select('code')).map((s) => s.code);
    const enrolments = [];
    inserted.forEach((row, i) => {
      const studentId = row.id ?? row;
      const picks = new Set([subjectCodes[i % subjectCodes.length], subjectCodes[(i * 3 + 1) % subjectCodes.length], subjectCodes[(i * 5 + 2) % subjectCodes.length]]);
      let j = 0;
      for (const subjectCode of picks) {
        enrolments.push({ studentId, subjectCode, gradeFinal: GRADES[(i + j++) % GRADES.length], gradeDate: `2026-06-${String(1 + (i % 28)).padStart(2, '0')}` });
      }
    });
    await trx('student_subject').insert(enrolments);
  });

  console.log(`seed: ${ACCOUNTS.length} accounts (password ${PASSWORD}), ${ROLES.length} roles, ${STUDENTS.length} students, ${SUBJECTS.length} subjects`);
}
