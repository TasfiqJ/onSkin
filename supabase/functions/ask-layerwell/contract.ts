export const ASK_GATEWAY_PROTOCOL_VERSION = "ask-gateway-source-v1" as const;
export const ASK_GATEWAY_OPERATION = "grounded_narration" as const;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const POSITIVE_DECIMAL = /^[1-9][0-9]{0,18}$/;
const SAFE_VERSION = /^[a-z0-9][a-z0-9._-]{0,95}$/;
const SAFE_CARD_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;

const SKIN_TYPES = new Set([
  "dry",
  "oily",
  "combination",
  "balanced",
  "unknown",
]);
const GOAL_CONCERNS = new Set([
  "appearance_of_breakouts",
  "appearance_of_dark_spots",
  "appearance_of_dryness",
  "appearance_of_redness",
  "appearance_of_texture",
  "appearance_of_lines",
]);

export type AskGatewayRequest = {
  protocolVersion: typeof ASK_GATEWAY_PROTOCOL_VERSION;
  operation: typeof ASK_GATEWAY_OPERATION;
  requestId: string;
  consentGeneration: string;
  locale: "en";
  question: string;
  context: {
    skinType: "dry" | "oily" | "combination" | "balanced" | "unknown" | null;
    sensitivity: boolean;
    pregnancyAware: boolean;
    goalConcern:
      | "appearance_of_breakouts"
      | "appearance_of_dark_spots"
      | "appearance_of_dryness"
      | "appearance_of_redness"
      | "appearance_of_texture"
      | "appearance_of_lines"
      | null;
    ingredientNames: string[];
  };
  grounding: {
    corpusVersion: string;
    promptVersion: string;
    evidenceCardIds: string[];
  };
};

export type AskGatewaySuccess = {
  protocolVersion: typeof ASK_GATEWAY_PROTOCOL_VERSION;
  requestId: string;
  status: "grounded";
  narration: string;
  citationCardIds: string[];
  modelSnapshot: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    estimatedCostMicros: number;
  };
};

export type AskGatewayErrorCode =
  | "account_changed"
  | "bad_request"
  | "circuit_open"
  | "consent_required"
  | "cost_ceiling"
  | "gateway_disabled"
  | "gateway_unavailable"
  | "method_not_allowed"
  | "payload_too_large"
  | "provider_timeout"
  | "quota_exceeded"
  | "request_in_progress"
  | "unauthorized";

export type AskGatewayError = {
  protocolVersion: typeof ASK_GATEWAY_PROTOCOL_VERSION;
  status: "error";
  error: AskGatewayErrorCode;
  retryable: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  return Object.keys(value).sort().join(",") === [...expected].sort().join(",");
}

export function hasDisallowedControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (
      code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) ||
      code === 127
    ) {
      return true;
    }
  }
  return false;
}

function boundedText(value: unknown, max: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= max &&
    value.trim() === value &&
    !hasDisallowedControlCharacter(value)
  );
}

function safeStringArray(
  value: unknown,
  maxItems: number,
  maxLength: number,
  minItems = 0,
  pattern?: RegExp,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.length >= minItems &&
    value.length <= maxItems &&
    value.every(
      (item) =>
        boundedText(item, maxLength) &&
        (!pattern || pattern.test(item)) &&
        item.normalize("NFKC") === item,
    ) &&
    new Set(value).size === value.length
  );
}

/**
 * Exact minimized transport contract. Product names, history, dates, photos,
 * profile free text, location, age, and arbitrary retrieved text have no field.
 * Evidence cards are server-resolved by reviewed identifiers in a later lane.
 */
export function parseAskGatewayRequest(
  value: unknown,
): AskGatewayRequest | null {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "protocolVersion",
      "operation",
      "requestId",
      "consentGeneration",
      "locale",
      "question",
      "context",
      "grounding",
    ]) ||
    value.protocolVersion !== ASK_GATEWAY_PROTOCOL_VERSION ||
    value.operation !== ASK_GATEWAY_OPERATION ||
    typeof value.requestId !== "string" ||
    !UUID.test(value.requestId) ||
    typeof value.consentGeneration !== "string" ||
    !POSITIVE_DECIMAL.test(value.consentGeneration) ||
    value.locale !== "en" ||
    !boundedText(value.question, 1000) ||
    value.question.normalize("NFKC") !== value.question ||
    !isRecord(value.context) ||
    !isRecord(value.grounding)
  ) {
    return null;
  }

  const context = value.context;
  if (
    !exactKeys(context, [
      "skinType",
      "sensitivity",
      "pregnancyAware",
      "goalConcern",
      "ingredientNames",
    ]) ||
    (context.skinType !== null &&
      (typeof context.skinType !== "string" ||
        !SKIN_TYPES.has(context.skinType))) ||
    typeof context.sensitivity !== "boolean" ||
    typeof context.pregnancyAware !== "boolean" ||
    (context.goalConcern !== null &&
      (typeof context.goalConcern !== "string" ||
        !GOAL_CONCERNS.has(context.goalConcern))) ||
    !safeStringArray(context.ingredientNames, 64, 80)
  ) {
    return null;
  }

  const grounding = value.grounding;
  if (
    !exactKeys(grounding, [
      "corpusVersion",
      "promptVersion",
      "evidenceCardIds",
    ]) ||
    typeof grounding.corpusVersion !== "string" ||
    !SAFE_VERSION.test(grounding.corpusVersion) ||
    typeof grounding.promptVersion !== "string" ||
    !SAFE_VERSION.test(grounding.promptVersion) ||
    !safeStringArray(grounding.evidenceCardIds, 12, 128, 1, SAFE_CARD_ID)
  ) {
    return null;
  }

  return {
    protocolVersion: ASK_GATEWAY_PROTOCOL_VERSION,
    operation: ASK_GATEWAY_OPERATION,
    requestId: value.requestId,
    consentGeneration: value.consentGeneration,
    locale: "en",
    question: value.question,
    context: {
      skinType: context.skinType as AskGatewayRequest["context"]["skinType"],
      sensitivity: context.sensitivity,
      pregnancyAware: context.pregnancyAware,
      goalConcern: context
        .goalConcern as AskGatewayRequest["context"]["goalConcern"],
      ingredientNames: [...context.ingredientNames],
    },
    grounding: {
      corpusVersion: grounding.corpusVersion,
      promptVersion: grounding.promptVersion,
      evidenceCardIds: [...grounding.evidenceCardIds],
    },
  };
}

export function askGatewayError(
  error: AskGatewayErrorCode,
  retryable = false,
): AskGatewayError {
  return {
    protocolVersion: ASK_GATEWAY_PROTOCOL_VERSION,
    status: "error",
    error,
    retryable,
  };
}
