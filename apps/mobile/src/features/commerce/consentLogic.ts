// Pure consent precedence (docs/10 §6, D-061), extracted from native/Supabase
// dependencies. An explicit false from either source locks commerce. Local false serves as
// the durable withdrawal-pending marker; local absence lets a new device honor a
// server grant.
export function resolveCommerceConsent(
  ledger: boolean | undefined,
  local: boolean | undefined,
): boolean {
  if (ledger === false || local === false) return false;
  return ledger === true || local === true;
}
