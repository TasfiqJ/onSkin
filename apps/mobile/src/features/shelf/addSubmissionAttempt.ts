import type { NewShelfProduct } from './store';

export type ShelfAddSubmissionAttempt = {
  readonly operationId: string;
  /** Exact canonical caller payload frozen before the first storage call. */
  readonly input: Readonly<NewShelfProduct>;
  productId: string | null;
};

/** Keep one mounted intake on the exact token/payload pair across uncertain responses. */
export function beginShelfAddSubmissionAttempt(
  current: ShelfAddSubmissionAttempt | null,
  operationId: string,
  createInput: () => NewShelfProduct,
): ShelfAddSubmissionAttempt {
  if (current) return current;
  return { operationId, input: createInput(), productId: null };
}
