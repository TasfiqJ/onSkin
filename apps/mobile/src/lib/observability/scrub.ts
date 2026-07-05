const SENSITIVE_CONTEXT_KEY =
  /(barcode|ingredient|ocr|raw_text|note|localuri|local_uri|file|path|photo|image|receipt|product|rule_id|content_id|conflict_text|pregnan|condition|diagnos|skin|goal|profile|free_text|message|body|email|phone|address|name|user_id|app_user_id|(^|_)age($|_)|birth|zip|postal|retinoid|retinol|aha|bha|benzoyl|hydroquinone|niacinamide|vitamin_c|sunscreen|peptide|dspt|fitzpatrick|monk|axis|step|score|slug|url|uri|query|route|params|search)/i;

const SENSITIVE_VALUE =
  /(@|https?:\/\/|file:\/\/|content:\/\/|\/data\/|\/var\/mobile\/|\/cache\/|\?.*=|barcode|ingredient|pregnan|diagnos|retinoid|retinol|aha|bha|benzoyl|hydroquinone|niacinamide|vitamin_c|sunscreen|skin profile|free text|receipt)/i;

type ScrubbedPrimitive = string | number | boolean | null;
type ScrubbedValue = ScrubbedPrimitive | ScrubbedPrimitive[] | ScrubbedContext;
export interface ScrubbedContext {
  [key: string]: ScrubbedValue;
}

function safeErrorName(value: unknown): string {
  if (typeof value !== 'string') return 'Error';
  const trimmed = value.trim();
  if (!trimmed || SENSITIVE_VALUE.test(trimmed) || SENSITIVE_CONTEXT_KEY.test(trimmed)) return 'Error';
  const normalized = trimmed.replace(/[^A-Za-z0-9_. -]/g, '').slice(0, 80).trim();
  return normalized || 'Error';
}

function scrubValue(value: unknown, depth: number): ScrubbedPrimitive | ScrubbedPrimitive[] | ScrubbedContext | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || SENSITIVE_VALUE.test(trimmed)) return undefined;
    return trimmed.slice(0, 120);
  }
  if (Array.isArray(value)) {
    if (depth >= 2) return undefined;
    const scrubbed = value
      .map((item) => scrubValue(item, depth + 1))
      .filter((item): item is ScrubbedPrimitive => item === null || ['string', 'number', 'boolean'].includes(typeof item));
    return scrubbed.length ? scrubbed.slice(0, 10) : undefined;
  }
  if (typeof value === 'object') {
    if (depth >= 2) return undefined;
    const nested = sanitizeObservabilityContext(value as Record<string, unknown>, depth + 1);
    return Object.keys(nested).length ? nested : undefined;
  }
  return undefined;
}

export function sanitizeObservabilityContext(
  context?: Record<string, unknown>,
  depth = 0,
): ScrubbedContext {
  if (!context) return {};

  const clean: ScrubbedContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (SENSITIVE_CONTEXT_KEY.test(key)) continue;
    const scrubbed = scrubValue(value, depth);
    if (scrubbed !== undefined) clean[key] = scrubbed;
  }
  return clean;
}

export function sanitizeCapturedException(error: unknown): Error {
  const safe = new Error('redacted_exception');
  safe.name = error instanceof Error ? safeErrorName(error.name) : safeErrorName(typeof error);
  return safe;
}
