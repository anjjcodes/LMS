import type { Page } from '@lms/shared';
import { encodeCursor } from './cursor';

/** Repositories fetch limit+1 rows; the extra row only tells us whether another page exists. */
export function toPage<R, D>(
  rows: R[],
  limit: number,
  toDto: (r: R) => D,
  cursorOf: (r: R) => Record<string, string | number>,
): Page<D> {
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const last = pageRows[pageRows.length - 1];
  return {
    data: pageRows.map(toDto),
    nextCursor: hasMore && last ? encodeCursor(cursorOf(last)) : null,
  };
}
