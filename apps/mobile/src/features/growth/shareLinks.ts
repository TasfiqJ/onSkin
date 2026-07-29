export type ConflictShareLink = {
  shareId: string;
  url: string;
};

/**
 * CORE-07A has no token issuer, URL builder, persistence, or network path.
 * Public-link admission is independent and literally closed.
 */
export async function createConflictShareLink(_request?: unknown): Promise<null> {
  return null;
}
