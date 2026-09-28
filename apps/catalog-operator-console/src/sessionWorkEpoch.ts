/**
 * Invalidates asynchronous work whenever an operator session ends or a new
 * one starts. Callers must re-check a captured epoch after every await before
 * writing session-scoped UI state.
 */
export class SessionWorkEpoch {
  #value = 0;

  begin(): number {
    this.#value += 1;
    return this.#value;
  }

  invalidate(): number {
    this.#value += 1;
    return this.#value;
  }

  capture(): number {
    return this.#value;
  }

  isCurrent(epoch: number): boolean {
    return Number.isSafeInteger(epoch) && epoch === this.#value;
  }
}
