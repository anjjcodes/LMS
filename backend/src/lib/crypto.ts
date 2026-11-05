import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';

const BCRYPT_COST = 12;
const API_KEY_PREFIX = 'lms_live_';
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export const hashPassword = (plain: string) => bcrypt.hash(plain, BCRYPT_COST);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

/**
 * A valid bcrypt hash of a random value. Compared against when the login email does not exist,
 * so "unknown email" and "wrong password" take the same time (no user enumeration via timing).
 */
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync(randomBytes(16).toString('hex'), BCRYPT_COST);

/** API keys are high-entropy random, so a fast SHA-256 is sufficient (unlike passwords). */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

export function generateApiKey(): string {
  const bytes = randomBytes(32);
  let out = '';
  for (const b of bytes) out += BASE62[b % 62];
  return `${API_KEY_PREFIX}${out}`;
}
