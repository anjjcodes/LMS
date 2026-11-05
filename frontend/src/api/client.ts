import type { ErrorBody, ErrorCode } from '@lms/shared';

/** Typed API error carrying the stable `code` from the backend error envelope. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK_ERROR',
    message: string,
    readonly details?: Record<string, unknown>,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type TokenGetter = () => string | null;
type UnauthorizedHandler = () => void;

let getToken: TokenGetter = () => null;
let onUnauthorized: UnauthorizedHandler = () => {};

/** Wired by AuthProvider: the token lives in React memory only (not localStorage). */
export function configureApiClient(opts: { getToken: TokenGetter; onUnauthorized: UnauthorizedHandler }) {
  getToken = opts.getToken;
  onUnauthorized = opts.onUnauthorized;
}

interface RequestOptions {
  body?: unknown;
  /** Send X-API-Key instead of the admin token (SaaS verify simulator). */
  apiKey?: string;
}

export async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.apiKey !== undefined) {
    headers['X-API-Key'] = opts.apiKey;
  } else {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection and try again.');
  }

  const text = await res.text();
  const data: unknown = text ? safeJson(text) : null;

  if (!res.ok) {
    const err = (data as ErrorBody | null)?.error;
    const apiErr = new ApiError(
      res.status,
      err?.code ?? 'INTERNAL_ERROR',
      err?.message ?? `Request failed (${res.status})`,
      err?.details,
      err?.requestId,
    );
    // Expired/invalid admin session → back to login. (API-key calls never trigger logout.)
    if (res.status === 401 && opts.apiKey === undefined && apiErr.code === 'UNAUTHENTICATED') onUnauthorized();
    throw apiErr;
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
