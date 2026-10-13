import nodemailer from 'nodemailer';
import { env, smtpConfigured } from '../../config/env';
import { logger } from '../../utils/logger';

export async function sendPasswordReset(email: string, token: string): Promise<void> {
  const text = [
    'A password reset was requested for your AgroHaven account.',
    '',
    `Reset token: ${token}`,
    '',
    'Submit this token to POST /api/v1/auth/reset-password.',
    `The token expires in ${env.PASSWORD_RESET_MINUTES} minutes.`,
    'If you did not request this, you can ignore this message.',
  ].join('\n');

  if (smtpConfigured && env.SMTP_HOST && env.SMTP_FROM) {
    const port = env.SMTP_PORT ?? 587;
    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      secure: port === 465,
      auth:
        env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
    await transport.sendMail({
      from: env.SMTP_FROM,
      to: email,
      subject: 'AgroHaven password reset',
      text,
    });
    return;
  }

  logger.error('Password reset was stored, but SMTP is not configured', { email });
}
