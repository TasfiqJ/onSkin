import type { AskIntent } from '@onskin/types';

// The deterministic intent router (docs/13 §4). It runs FIRST — BEFORE any language
// model — so medical/dosing/diagnosis intent is caught at the door and ESCALATED, never
// narrated (the input-side safety control). Pure + unit-tested. Order matters: medical
// is checked first (safety), then the deterministic on-device intents, then the
// corpus-grounded concern bucket, then out-of-scope. This is a router, not a classifier
// of meaning — it errs toward escalate/refuse, never toward a confident wrong answer.

// Medical / severe / dosing / diagnosis — ALWAYS escalate, never answer. Deliberately
// broad: a false "escalate" is safe; a false "answer" on a medical question is not.
const MEDICAL = [
  /\b(antibiotic|prescri\w*|accutane|isotretinoin|tretinoin|hydrocortisone|steroid|prednisone)\b/i,
  /\b(dose|dosage|how much should i|how many mg|mg\b|ml\b)\b/i,
  /\b(diagnos\w*|do i have|is this (a sign of|cancer|a tumou?r|infected)|melanoma|skin cancer|tumou?r)\b/i,
  /\b(cyst|cystic|abscess|boil|infected|infection|pus|bleeding|oozing|painful|severe|spreading rash|won.?t heal)\b/i,
  /\b(mole|lesion|growth) (chang|grow|bleed|new)/i,
  /\b(see|need|should i see) (a )?(doctor|dermatologist|derm|gp|specialist)\b/i,
];

const CONFLICT = [
  /\b(conflict|clash|clashe?s?|incompatib\w*)\b/i,
  /\buse\b.*\bwith\b/i,
  /\b(combine|combin\w*|mix|layer|stack)\b/i,
  /\b(same (night|time|evening)|together|at once)\b/i,
];

const ROUTINE = [
  /\b(tonight|this evening|right now|today)\b/i,
  /\bwhat should i (do|use|apply)\b/i,
  /\b(my )?(pm|am|evening|morning|night) routine\b/i,
  /\bwhat.?s my routine\b/i,
  /\b(order|sequence|step order)\b/i,
];

const REPLENISH = [
  /\b(running low|run out|running out|out of|finished|empty|used up)\b/i,
  /\b(replace|repurchase|replenish|reorder|buy again)\b/i,
  /\b(expir\w*|past its date|pao)\b/i,
];

const PRODUCT_FIT = [
  /\b(fit for me|right for me|good for me|work for me|suit me)\b/i,
  /\b(worth it|worth buying|should i (buy|get|add|try|use))\b/i,
  /\bis this (product |serum |cream |one )?(a fit|right|good|worth)/i,
  /\bshould i add\b/i,
];

// A cosmetic-concern question that would need the curated corpus (the grounded path).
const CONCERN = [
  /\b(ingredient|benefit|help with|good for)\b/i,
  /\bwhat\s+(is|are|does|s)\b/i,
  /\bhow\s+(does|do i|to)\b/i,
  /\b(why|explain|tell me about)\b/i,
  /\b(routine for|best for|recommend)\b/i,
  /\bis .* (good|worth|safe|ok|fine)\b/i,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(text));
}

/** Route a free-text question to a deterministic intent (docs/13 §4). Medical first. */
export function classifyIntent(question: string): AskIntent {
  const q = question.toLowerCase().trim();
  if (q.length === 0) return 'out_of_scope';
  if (matchesAny(q, MEDICAL)) return 'medical';
  if (matchesAny(q, CONFLICT)) return 'conflict_q';
  if (matchesAny(q, ROUTINE)) return 'routine_q';
  if (matchesAny(q, REPLENISH)) return 'replenish_q';
  if (matchesAny(q, PRODUCT_FIT)) return 'product_fit_q';
  if (matchesAny(q, CONCERN)) return 'concern_q';
  return 'out_of_scope';
}
