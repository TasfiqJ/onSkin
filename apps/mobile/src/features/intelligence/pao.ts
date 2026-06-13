// PAO / expiry intelligence (docs/02 §6). PAO is EU/UK law only — US products
// frequently lack it — so resolve label → category default → honest "unknown",
// NEVER a fabricated date. Pure + testable.

/** Conservative category defaults (mirrors ingredient_pao_defaults seed, §6). */
export const CATEGORY_PAO_DEFAULTS: Record<string, number> = {
  vitamin_c_serum: 4,
  mascara: 4,
  eye_liquid: 4,
  benzoyl_peroxide: 6,
  spf: 12,
  serum: 9,
  toner: 9,
  moisturiser_tube: 12,
  moisturiser_jar: 8,
  oil_balm: 18,
  cleanser: 12,
};

/** Resolve PAO months: explicit label/catalog value, else category default, else null. */
export function resolvePaoMonths(opts: {
  paoMonths?: number | null;
  catalogDefault?: number | null;
  category?: string | null;
}): number | null {
  if (opts.paoMonths != null) return opts.paoMonths;
  if (opts.catalogDefault != null) return opts.catalogDefault;
  if (opts.category && CATEGORY_PAO_DEFAULTS[opts.category] != null) {
    return CATEGORY_PAO_DEFAULTS[opts.category]!;
  }
  return null;
}

function parseLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

/** Whichever is sooner of an explicit expiry and the PAO-derived date (§6, mirrors
 *  the DB generated column). Returns an ISO date string or null when unknowable. */
export function computeExpiry(opts: {
  openedAt?: string | null;
  paoMonths?: number | null;
  expiryDate?: string | null;
}): string | null {
  const candidates: Date[] = [];
  if (opts.expiryDate) candidates.push(parseLocal(opts.expiryDate));
  if (opts.openedAt && opts.paoMonths != null) {
    const d = parseLocal(opts.openedAt);
    d.setMonth(d.getMonth() + opts.paoMonths);
    candidates.push(d);
  }
  if (candidates.length === 0) return null;
  const soonest = candidates.reduce((a, b) => (a < b ? a : b));
  const y = soonest.getFullYear();
  const mm = String(soonest.getMonth() + 1).padStart(2, '0');
  const dd = String(soonest.getDate()).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

export type ExpiryBadge =
  | { kind: 'date'; label: string }
  | { kind: 'countdown'; label: string }
  | { kind: 'expired'; label: string }
  | { kind: 'unknown'; label: string };

/** The shelf badge for a product (docs/02 §6 / §7.6 badge taxonomy). */
export function expiryBadge(
  expiryISO: string | null,
  todayISO: string,
  thresholdDays = 30,
): ExpiryBadge {
  if (!expiryISO) return { kind: 'unknown', label: 'PAO unknown' };
  const days = Math.round((parseLocal(expiryISO).getTime() - parseLocal(todayISO).getTime()) / 86_400_000);
  if (days < 0) return { kind: 'expired', label: 'Replace' };
  if (days <= thresholdDays) {
    const wks = Math.round(days / 7);
    return { kind: 'countdown', label: wks <= 1 ? `${days} days left` : `${wks} wks left` };
  }
  const label = parseLocal(expiryISO).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  return { kind: 'date', label };
}
