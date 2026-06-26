// PAO / expiry intelligence (docs/02 §6). PAO is EU/UK law only. US products
// frequently lack it. So resolve label → category default → honest "unknown",
// NEVER a fabricated date. Pure + testable.

/** Conservative category defaults (mirrors ingredient_pao_defaults seed, docs/02
 *  §6 + docs/04 §3 table). Every number is a B-DERM-REVIEW starting position , 
 *  formulation/packaging shift the real value (airless pumps extend, jars
 *  shorten). 'spf' falls back here but a printed expiry should win (§3). */
export const CATEGORY_PAO_DEFAULTS: Record<string, number> = {
  vitamin_c_serum: 4, // oxidises quickly once opened (Baumann ~4 wks once browning)
  retinoid_serum: 6, // breaks down with air/heat/light
  mascara: 4, // eye-area microbial risk
  eye_liquid: 4,
  eye_cream: 6,
  lash_brow: 4, // eye area
  benzoyl_peroxide: 6, // oxidiser; potency decay
  spf: 12, // OTC drug. Prefer the printed expiry; this is only the fallback
  serum: 9, // water-based serum/toner 6-12
  toner: 9,
  moisturiser_tube: 12, // lower contamination than jars
  moisturiser_jar: 8, // finger-dipping contamination
  oil_balm: 18, // low water activity → slow microbial growth
  cleanser: 12, // short contact, rinsed
};

// *** BLOCKED: B-DERM-REVIEW. The CATEGORY_PAO_DEFAULTS above are UNREVIEWED
// *** starting positions (docs/04 §3). Like the conflict matrix (rules.ts), they
// *** are medical-adjacent and must be signed off by a cosmetic chemist before
// *** being presented as authoritative to real users. Until sign-off, production
// *** withholds them and the shelf degrades to the honest "PAO est." state;
// *** development uses them so the shelf is demoable. Flip to true after sign-off.
export const PAO_DEFAULTS_REVIEWED = false;

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

/** The category default, gated by the B-DERM-REVIEW launch gate (mirrors
 *  `shippableRules` in rules.ts): used in development so the shelf is demoable,
 *  withheld in production until cosmetic-chemist sign-off. Where intake falls
 *  back to the honest "estimated/unknown" state rather than a fabricated number. */
export function reviewedCategoryPao(category: string | null | undefined): number | null {
  if (!category) return null;
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  if (!isDev && !PAO_DEFAULTS_REVIEWED) return null;
  return resolvePaoMonths({ category });
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

/** The five badge states (docs/04 §5.3). `safety` carries the firmer eye/SPF
 *  treatment ("replace for safety") on an expired item; text always reads its
 *  meaning so colour is never load-bearing (accessibility, §5.9). */
export type ExpiryBadgeKind = 'date' | 'countdown' | 'paired' | 'expired' | 'unknown';
export type ExpiryBadge = {
  kind: ExpiryBadgeKind;
  label: string;
  safety?: boolean;
};

export type ExpiryBadgeOpts = {
  thresholdDays?: number;
  /** Eye-area / sunscreen → expired copy is firmer (docs/04 §3 exceptions). */
  safetyCritical?: boolean;
  /** A conflict on this product is already resolved by the engine/scheduler , 
   *  shows "paired" instead of a neutral future date (docs/04 §5.3). */
  paired?: boolean;
};

/** The shelf badge for a product (docs/04 §5.3 badge taxonomy). Date-driven,
 *  with `paired` overriding only the calm future-date state and `safetyCritical`
 *  firming up an expired eye/SPF item. Never an urgent countdown. */
export function expiryBadge(
  expiryISO: string | null,
  todayISO: string,
  opts: ExpiryBadgeOpts = {},
): ExpiryBadge {
  const { thresholdDays = 30, safetyCritical = false, paired = false } = opts;
  if (!expiryISO) return { kind: 'unknown', label: 'PAO est.' };
  const days = Math.round((parseLocal(expiryISO).getTime() - parseLocal(todayISO).getTime()) / 86_400_000);
  if (days < 0) {
    // Past best-by. Calm "Replace" by default; firmer for the eye/SPF cases.
    return safetyCritical
      ? { kind: 'expired', label: 'replace\nfor safety', safety: true }
      : { kind: 'expired', label: 'Replace' };
  }
  if (days <= thresholdDays) {
    const wks = Math.round(days / 7);
    return { kind: 'countdown', label: wks <= 1 ? `${days} days left` : `${wks} wks left` };
  }
  // Comfortably ahead: "paired" (handled) takes the calm slot if applicable,
  // otherwise the neutral month/year.
  if (paired) return { kind: 'paired', label: 'paired' };
  const label = parseLocal(expiryISO).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  return { kind: 'date', label };
}
