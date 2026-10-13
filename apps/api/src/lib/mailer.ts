import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from './logger.js';

export const smtpEnabled = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
const transport = smtpEnabled
  ? nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465, auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } })
  : null;

/** devLink is only ever logged in development when SMTP is absent; never in production. */
export async function sendMail(to: string, subject: string, text: string, devLink?: string) {
  if (!transport) {
    if (env.NODE_ENV === 'development') logger.info({ to, subject, link: devLink }, '[dev mail] SMTP not configured');
    else logger.warn({ subject }, 'SMTP not configured; email not sent');
    return;
  }
  await transport.sendMail({ from: env.EMAIL_FROM, to, subject, text });
}
