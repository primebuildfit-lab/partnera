/**
 * Cursor-based pagination contract used by every repository. Cursor (not offset)
 * because it stays correct and cheap over large, append-heavy tables like the
 * commission ledger and click stream.
 */
export interface PageRequest {
  readonly cursor?: string;
  readonly limit: number;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  /** Optional total; omitted when counting would be too expensive. */
  readonly total?: number;
}

export const DEFAULT_PAGE_LIMIT = 25;
export const MAX_PAGE_LIMIT = 200;

/** Clamp a requested limit into the allowed range. */
export function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_PAGE_LIMIT;
  return Math.max(1, Math.min(Math.floor(limit), MAX_PAGE_LIMIT));
}

export function emptyPage<T>(): Page<T> {
  return { items: [], nextCursor: null, total: 0 };
}
