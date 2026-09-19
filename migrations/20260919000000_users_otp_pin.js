export async function up(knex) {
  await knex.schema.alterTable('users', t => {
    t.string('otp_pin', 12).nullable();
  });
}

export async function down(knex) {
  await knex.schema.alterTable('users', t => {
    t.dropColumn('otp_pin');
  });
}
