// Pure consent precedence (docs/10 §6, D-061) — extracted so it can be unit-tested
// without the native/Supabase deps that consent.ts pulls in. The immutable ledger is
// AUTHORITATIVE when it has a data_sharing entry (so a revocation — a newer
// granted=false row — re-locks the "where to buy" affordance even if a stale local
// flag still says granted); only when the ledger is unavailable (offline / no backend)
// does the local-first flag govern.
export function resolveCommerceConsent(ledger: boolean | undefined, local: boolean): boolean {
  return ledger === undefined ? local : ledger;
}
