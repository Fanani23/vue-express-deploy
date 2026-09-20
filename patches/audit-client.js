// Reports sign-in events to TaskPulse's audit trail (POST /api/audit with the shared X-Internal-Token) - installed by
// patches/0021-auth-audit.js as common/compiled/node/services/audit.js. Fire-and-forget with a short timeout: a
// sign-in never waits for, or fails because of, the audit call. Off when TASKPULSE_AUDIT_URL is unset.
const { TASKPULSE_AUDIT_URL, TASKPULSE_AUDIT_TOKEN } = process.env;

const clientIp = req => String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim() || req?.ip || 'unknown';

/**
 * auditEvent(req, { actor, action, targetId, summary, resource = 'auth', kind })
 *   action: signin | signin-failed | lockout | signout | signout-all | reuse | otp-failed | account-create | ...
 */
export const auditEvent = (req, { actor, action, targetId, summary, resource = 'auth', kind }) => {
  if (!TASKPULSE_AUDIT_URL) return;
  const body = JSON.stringify({
    actor: actor ? String(actor).slice(0, 120) : null,
    action,
    resource,
    kind: kind || null,
    targetId: String(targetId ?? 'unknown').slice(0, 64),
    summary: `${summary} · from ${clientIp(req)}`.slice(0, 200),
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  fetch(TASKPULSE_AUDIT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Token': TASKPULSE_AUDIT_TOKEN || '' },
    body,
    signal: controller.signal,
  })
    .then(r => { if (!r.ok) (globalThis.logger ?? console).warn?.(`audit event ${action}: TaskPulse answered ${r.status}`); })
    .catch(e => (globalThis.logger ?? console).warn?.(`audit event ${action} not delivered: ${e?.message || e}`))
    .finally(() => clearTimeout(timer));
};
