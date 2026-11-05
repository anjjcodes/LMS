import { pino } from 'pino';
import { env, isTest } from '../config/env';

export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  // Never log credentials. Request bodies are not logged at all (they carry employee emails = PII).
  redact: {
    paths: ['req.headers.authorization', 'req.headers["x-api-key"]', 'req.headers.cookie'],
    censor: '[REDACTED]',
  },
});

/** Mask an email for logs: ravi.kumar@acme.com → r***@acme.com */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  return `${email[0]}***${email.slice(at)}`;
}
