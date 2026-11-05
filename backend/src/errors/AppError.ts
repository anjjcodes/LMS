import { ErrorCodes, type ErrorCode } from '@lms/shared';

/** A business/domain error that maps 1:1 to the API error envelope. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = ErrorCodes[code];
    this.details = details;
  }
}
