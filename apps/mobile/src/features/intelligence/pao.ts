// PAO / expiry intelligence (docs/02 §6). Labeling requirements and available
// package dates vary by product and jurisdiction. Resolve reviewed product data
// first and otherwise preserve an honest unknown state. Pure + testable.

function parseLocal(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

function formatLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addCalendarMonths(iso: string, months: number): string | null {
  const date = parseLocal(iso);
  if (!date || !Number.isInteger(months) || months <= 0) return null;
  const absoluteMonth = date.getFullYear() * 12 + date.getMonth() + months;
  const year = Math.floor(absoluteMonth / 12);
  const month = absoluteMonth - year * 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return formatLocal(new Date(year, month, Math.min(date.getDate(), lastDay)));
}

export type ComputedExpiry = {
  date: string | null;
  source: 'printed' | 'pao_computed' | 'unknown';
};

export function computeExpiryWithSource(opts: {
  openedAt?: string | null;
  paoMonths?: number | null;
  expiryDate?: string | null;
}): ComputedExpiry {
  const printedDate = opts.expiryDate && parseLocal(opts.expiryDate) ? opts.expiryDate : null;
  const paoDate =
    opts.openedAt && opts.paoMonths != null
      ? addCalendarMonths(opts.openedAt, opts.paoMonths)
      : null;

  if (printedDate && (!paoDate || printedDate <= paoDate)) {
    return { date: printedDate, source: 'printed' };
  }
  if (paoDate) return { date: paoDate, source: 'pao_computed' };
  return { date: null, source: 'unknown' };
}

/** Whichever is sooner of an explicit expiry and the PAO-derived date (§6, mirrors
 *  the DB generated column). Returns an ISO date string or null when unknowable. */
export function computeExpiry(opts: {
  openedAt?: string | null;
  paoMonths?: number | null;
  expiryDate?: string | null;
}): string | null {
  return computeExpiryWithSource(opts).date;
}

/** The badge states (docs/04 §5.3). Text always reads its meaning so colour is
 *  never load-bearing (accessibility, §5.9). `synergy` is the calm positive
 *  badge for a product in a surfaced synergy/myth pairing. */
export type ExpiryBadgeKind = 'date' | 'countdown' | 'paired' | 'expired' | 'unknown' | 'synergy';
export type ExpiryBadge = {
  kind: ExpiryBadgeKind;
  label: string;
};

export type ExpiryBadgeOpts = {
  thresholdDays?: number;
  /** A conflict on this product is already resolved by the engine/scheduler ,
   *  shows "paired" instead of a neutral future date (docs/04 §5.3). */
  paired?: boolean;
  /** This product is part of a surfaced synergy/myth pairing , takes the calm
   *  slot with a sage "synergy" pill instead of a neutral future date (design
   *  frame 03, Niacinamide 10%). */
  synergy?: boolean;
  /** The surfaced expiry is only an estimate (a category PAO default, not a
   *  label/catalog value). Every temporal state keeps the honest two-line mono
   *  "est.\n{Mon}" rather than fabricating countdown or replacement urgency. */
  estimate?: boolean;
};

/** The shelf badge for a product (docs/04 §5.3 badge taxonomy). Date-driven,
 *  with `paired` overriding only the calm future-date state. Never an urgent
 *  countdown or an unreviewed safety claim. */
export function expiryBadge(
  expiryISO: string | null,
  todayISO: string,
  opts: ExpiryBadgeOpts = {},
): ExpiryBadge {
  const {
    thresholdDays = 30,
    paired = false,
    synergy = false,
    estimate = false,
  } = opts;
  if (!expiryISO) return { kind: 'unknown', label: 'Date unknown' };
  const expiryDate = parseLocal(expiryISO);
  const todayDate = parseLocal(todayISO);
  if (!expiryDate || !todayDate) return { kind: 'unknown', label: 'Date unknown' };
  const days = Math.round((expiryDate.getTime() - todayDate.getTime()) / 86_400_000);
  if (estimate) {
    const monthYear = expiryDate.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
    return { kind: 'unknown', label: `est.\n${monthYear}` };
  }
  if (days < 0) {
    return { kind: 'expired', label: 'Time to replace' };
  }
  if (days <= thresholdDays) {
    const wks = Math.round(days / 7);
    return { kind: 'countdown', label: wks <= 1 ? `${days} days left` : `${wks} wks left` };
  }
  // Comfortably ahead. The calm slot is, in priority: "paired" (a resolved
  // conflict), then "synergy" (a surfaced good pairing), else month/year.
  if (paired) return { kind: 'paired', label: 'paired' };
  if (synergy) return { kind: 'synergy', label: 'synergy' };
  const label = expiryDate.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
  return { kind: 'date', label };
}
