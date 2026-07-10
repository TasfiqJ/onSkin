import type { FunctionalTag } from '@onskin/types';

// Coarse concentration band (docs/02 §4.2). The engine escalates irritation/stability
// severity by +1 for a high-dose product, and gates the high-dose-salicylic x
// pregnancy SAFETY rule on it. Until the curated catalog carries
// `product_ingredients.concentration_band` (B-CATALOG-SEED), we derive a band by
// parsing a percent from the product name / INCI text and comparing to a per-class
// threshold. No percent => undefined (the engine treats absent as low). This re-enables
// the headline "0.3% retinol is not 1.0% retinol" promise and makes the high-dose
// pregnancy safety rule actually reachable. Pure + unit-tested.
const PCT = /(\d+(?:\.\d+)?)\s*%/;

// Per-active-class "high-dose" thresholds (percent). Conservative starting positions;
// a B-DERM-REVIEW item like the rest of the matrix.
const HIGH_THRESHOLD: Partial<Record<FunctionalTag, number>> = {
  retinoid: 0.5, // 0.3% reads low; >= 0.5% reads high
  aha: 8, // glycolic / lactic: >= 8% high
  bha: 2, // salicylic: >= 2% is the high-dose pregnancy-caution line
  vitamin_c: 15, // L-ascorbic acid: >= 15% high
  benzoyl_peroxide: 5,
};

/** 'high' when a parsed percent meets any relevant active's threshold; 'low' when a
 *  percent is present but below all thresholds; undefined when no percent is found. */
export function deriveConcentration(
  text: string,
  tags: FunctionalTag[],
): 'low' | 'high' | undefined {
  const m = PCT.exec(text);
  if (!m) return undefined;
  const pct = parseFloat(m[1]!);
  if (Number.isNaN(pct)) return undefined;
  let relevant = false;
  for (const tag of tags) {
    const t = HIGH_THRESHOLD[tag];
    if (t == null) continue;
    relevant = true;
    if (pct >= t) return 'high';
  }
  return relevant ? 'low' : undefined;
}
