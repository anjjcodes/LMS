import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { z } from 'zod';
import { AppError } from '../errors/AppError';

interface Schemas {
  params?: ZodType;
  query?: ZodType;
  body?: ZodType;
}

/**
 * Validates and normalizes params/query/body with Zod. Parsed values land on `req.valid`;
 * handlers read ONLY from there, never from raw req.body (prevents unvalidated input / mass assignment).
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    const fields: { path: string; message: string }[] = [];
    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const input = part === 'body' ? (req.body ?? {}) : req[part];
      const result = schema.safeParse(input);
      if (result.success) {
        req.valid[part] = result.data;
      } else {
        for (const issue of result.error.issues) {
          fields.push({
            path: [part, ...issue.path.map(String)].join('.'),
            message: issue.message,
          });
        }
      }
    }
    if (fields.length > 0) {
      return next(new AppError('VALIDATION_ERROR', 'Request validation failed', { fields }));
    }
    next();
  };
}

/** Typed accessor for validated request parts. */
export function valid<S extends ZodType>(value: unknown, _schema: S): z.infer<S> {
  return value as z.infer<S>;
}
