import { z } from 'zod';

/** Canonical email: trimmed + lowercased at the edge so every layer sees one form. */
export const emailSchema = z
  .string({ error: 'email is required' })
  .trim()
  .toLowerCase()
  .max(320, 'email must be at most 320 characters')
  .pipe(z.email('must be a valid email address'));

/** True only for real calendar dates (rejects 2026-02-30). */
export function isRealCalendarDate(value: string): boolean {
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date in YYYY-MM-DD format')
  .refine(isRealCalendarDate, 'must be a real calendar date');

export const uuidSchema = z.uuid('must be a valid UUID');

export const pageLimitSchema = z.coerce.number().int().min(1).max(200).default(50);
export const cursorSchema = z.string().max(200).optional();
