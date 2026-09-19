import { createRequire } from 'node:module';

const { SMTP_HOST, SMTP_PORT = '465', SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

let transport;

const consoleTransport = {
  name: 'console',
  async sendMail(msg) {
    (globalThis.logger ?? console).info(`[mailer:console] to=${msg.to} subject="${msg.subject}" text="${msg.text}"`);
    return { messageId: `console-${Date.now()}`, accepted: [msg.to] };
  },
};

const getTransport = () => {
  if (transport) return transport;
  if (!SMTP_HOST) return (transport = consoleTransport);
  const require = createRequire(import.meta.url);
  const nodemailer = require('nodemailer');
  const port = Number(SMTP_PORT);
  transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
  transport.name = 'smtp';
  return transport;
};

export const sendMail = async msg => {
  const t = getTransport();
  const from = SMTP_FROM || SMTP_USER || 'no-reply@localhost';
  return t.sendMail({ from, ...msg });
};

export const mailerName = () => getTransport().name;
