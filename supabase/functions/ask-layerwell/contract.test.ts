import {
  ASK_GATEWAY_OPERATION,
  ASK_GATEWAY_PROTOCOL_VERSION,
  parseAskGatewayRequest,
} from "./contract.ts";

function assert(
  condition: unknown,
  message = "assertion failed",
): asserts condition {
  if (!condition) throw new Error(message);
}

function request() {
  return {
    protocolVersion: ASK_GATEWAY_PROTOCOL_VERSION,
    operation: ASK_GATEWAY_OPERATION,
    requestId: "123e4567-e89b-42d3-a456-426614174000",
    consentGeneration: "4",
    locale: "en",
    question: "How should I think about this ingredient?",
    context: {
      skinType: "dry",
      sensitivity: true,
      pregnancyAware: false,
      goalConcern: "appearance_of_texture",
      ingredientNames: ["niacinamide"],
    },
    grounding: {
      corpusVersion: "corpus-2026-09-26",
      promptVersion: "prompt-v1",
      evidenceCardIds: ["ingredient:niacinamide:v1"],
    },
  };
}

Deno.test("ASK gateway request accepts only the exact minimized English contract", () => {
  const parsed = parseAskGatewayRequest(request());
  assert(parsed?.requestId === request().requestId);
  for (
    const extra of [
      { profileFreeText: "private" },
      { photoUri: "file:///private/photo.jpg" },
      { productHistory: ["purchase"] },
      { preciseAge: 31 },
    ]
  ) {
    assert(parseAskGatewayRequest({ ...request(), ...extra }) === null);
  }
});

Deno.test("ASK gateway request rejects malformed identity, purpose, locale, and unbounded fields", () => {
  assert(
    parseAskGatewayRequest({ ...request(), requestId: "not-a-uuid" }) === null,
  );
  assert(
    parseAskGatewayRequest({ ...request(), consentGeneration: "0" }) === null,
  );
  assert(parseAskGatewayRequest({ ...request(), locale: "fr" }) === null);
  assert(
    parseAskGatewayRequest({ ...request(), question: "x".repeat(1001) }) ===
      null,
  );
  assert(
    parseAskGatewayRequest({
      ...request(),
      context: { ...request().context, ingredientNames: ["x\u0000y"] },
    }) === null,
  );
  assert(
    parseAskGatewayRequest({
      ...request(),
      grounding: { ...request().grounding, evidenceCardIds: ["../../private"] },
    }) === null,
  );
  assert(
    parseAskGatewayRequest({
      ...request(),
      grounding: { ...request().grounding, evidenceCardIds: [] },
    }) === null,
    "grounded requests require evidence",
  );
});
