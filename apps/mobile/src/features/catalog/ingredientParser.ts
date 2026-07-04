import type { FunctionalTag, IngredientSubflag } from '@onskin/types';

import { tagsForIngredient } from '@/features/intelligence/tags';

import {
  displayIngredientToken,
  normalizeIngredientToken,
  normalizeWhitespace,
  parsePercent,
} from './normalization';

export const INGREDIENT_PARSER_VERSION = 'phase4-inci-parser-v1';

export type IngredientParserSection = 'main' | 'active' | 'inactive' | 'may_contain';
export type IngredientMatchType = 'exact' | 'synonym' | 'fuzzy' | 'unknown';
export type IngredientParseStatus = 'parsed' | 'partial' | 'failed';

export type ParsedIngredientToken = {
  position: number;
  rawToken: string;
  normalizedToken: string;
  displayName: string;
  section: IngredientParserSection;
  matchType: IngredientMatchType;
  matchConfidence: number;
  isUnmatched: boolean;
  tags: FunctionalTag[];
  subflags: IngredientSubflag[];
  percent: number | null;
};

export type IngredientParseResult = {
  rawText: string;
  parserVersion: string;
  status: IngredientParseStatus;
  confidence: number;
  tokens: ParsedIngredientToken[];
  unknownTokens: string[];
  matchedTokenCount: number;
  activeSectionFound: boolean;
  inactiveSectionFound: boolean;
  mayContainSectionFound: boolean;
  warnings: string[];
};

const COMMON_INCI = new Set([
  'water',
  'glycerin',
  'cetearyl alcohol',
  'cetyl alcohol',
  'stearyl alcohol',
  'caprylic / capric triglyceride',
  'caprylic/capric triglyceride',
  'dimethicone',
  'tocopherol',
  'sodium hyaluronate',
  'hyaluronic acid',
  'panthenol',
  'phenoxyethanol',
  'ethylhexylglycerin',
  'carbomer',
  'xanthan gum',
  'sodium hydroxide',
  'disodium edta',
  'allantoin',
  'squalane',
  'ceramide np',
]);

const SECTION_MARKERS: { section: IngredientParserSection; pattern: RegExp }[] = [
  { section: 'active', pattern: /\bactive ingredients?\s*:/gi },
  { section: 'inactive', pattern: /\binactive ingredients?\s*:/gi },
  { section: 'may_contain', pattern: /\bmay (?:also )?contain\s*:/gi },
  { section: 'may_contain', pattern: /\bpeut contenir\s*:/gi },
];

function markSections(value: string): string {
  let out = value;
  for (const marker of SECTION_MARKERS) {
    out = out.replace(marker.pattern, `|||SECTION:${marker.section}|||`);
  }
  return out;
}

function splitKeepingSections(value: string): { section: IngredientParserSection; text: string }[] {
  const marked = markSections(value);
  const parts = marked.split(/\|\|\|SECTION:(active|inactive|may_contain)\|\|\|/);
  const out: { section: IngredientParserSection; text: string }[] = [];
  let current: IngredientParserSection = 'main';
  for (const part of parts) {
    if (part === 'active' || part === 'inactive' || part === 'may_contain') {
      current = part;
      continue;
    }
    if (part.trim()) out.push({ section: current, text: part });
  }
  return out;
}

function splitIngredientTokens(value: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of value) {
    if (char === '(' || char === '[') depth += 1;
    if (char === ')' || char === ']') depth = Math.max(0, depth - 1);

    if (depth === 0 && (char === ',' || char === ';' || char === '\n')) {
      const trimmed = normalizeWhitespace(current);
      if (trimmed) tokens.push(trimmed);
      current = '';
      continue;
    }
    current += char;
  }

  const trimmed = normalizeWhitespace(current);
  if (trimmed) tokens.push(trimmed);
  return tokens;
}

function confidenceForToken(
  normalizedToken: string,
  rawToken: string,
  tags: ReturnType<typeof tagsForIngredient>,
): Pick<ParsedIngredientToken, 'matchType' | 'matchConfidence' | 'isUnmatched'> {
  if (tags.length > 0) {
    return {
      matchType: normalizedToken === normalizeWhitespace(rawToken).toLowerCase() ? 'exact' : 'synonym',
      matchConfidence: 0.92,
      isUnmatched: false,
    };
  }
  if (COMMON_INCI.has(normalizedToken)) {
    return { matchType: 'exact', matchConfidence: 0.78, isUnmatched: false };
  }
  if (/^ci\s+\d{5}$/i.test(normalizedToken) || /^[a-z]+\s+\d{4,5}$/i.test(normalizedToken)) {
    return { matchType: 'fuzzy', matchConfidence: 0.62, isUnmatched: false };
  }
  return { matchType: 'unknown', matchConfidence: 0.15, isUnmatched: true };
}

export function parseIngredientText(rawText: string): IngredientParseResult {
  const raw = rawText.replace(/\r\n/g, '\n').trim();
  const warnings: string[] = [];

  if (raw.length === 0) {
    return {
      rawText,
      parserVersion: INGREDIENT_PARSER_VERSION,
      status: 'failed',
      confidence: 0,
      tokens: [],
      unknownTokens: [],
      matchedTokenCount: 0,
      activeSectionFound: false,
      inactiveSectionFound: false,
      mayContainSectionFound: false,
      warnings: ['empty_ingredient_text'],
    };
  }

  const sectioned = splitKeepingSections(raw);
  const tokens: ParsedIngredientToken[] = [];
  let position = 1;

  for (const section of sectioned) {
    for (const token of splitIngredientTokens(section.text)) {
      const normalizedToken = normalizeIngredientToken(token);
      if (!normalizedToken) continue;
      const tagDefs = tagsForIngredient(normalizedToken);
      const match = confidenceForToken(normalizedToken, token, tagDefs);
      tokens.push({
        position,
        rawToken: token,
        normalizedToken,
        displayName: displayIngredientToken(token),
        section: section.section,
        tags: [...new Set(tagDefs.map((def) => def.tag))],
        subflags: [...new Set(tagDefs.map((def) => def.subflag).filter(Boolean))] as IngredientSubflag[],
        percent: parsePercent(token),
        ...match,
      });
      position += 1;
    }
  }

  const unknownTokens = tokens.filter((token) => token.isUnmatched).map((token) => token.rawToken);
  const matchedTokenCount = tokens.length - unknownTokens.length;
  if (unknownTokens.length > 0) warnings.push('unknown_tokens_preserved');
  if (tokens.some((token) => token.percent != null)) warnings.push('label_percentage_detected_review_required');

  const average =
    tokens.length === 0
      ? 0
      : tokens.reduce((sum, token) => sum + token.matchConfidence, 0) / tokens.length;
  const unknownPenalty = tokens.length === 0 ? 0 : Math.min(0.35, unknownTokens.length / tokens.length / 2);
  const confidence = Math.max(0, Math.min(1, Number((average - unknownPenalty).toFixed(2))));

  return {
    rawText,
    parserVersion: INGREDIENT_PARSER_VERSION,
    status: tokens.length === 0 ? 'failed' : unknownTokens.length > 0 ? 'partial' : 'parsed',
    confidence,
    tokens,
    unknownTokens,
    matchedTokenCount,
    activeSectionFound: tokens.some((token) => token.section === 'active'),
    inactiveSectionFound: tokens.some((token) => token.section === 'inactive'),
    mayContainSectionFound: tokens.some((token) => token.section === 'may_contain'),
    warnings,
  };
}
