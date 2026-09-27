export const TREND_ENGINE_INPUT_SCHEMA_VERSION = 1 as const;
export const TREND_RESULT_RECEIPT_SCHEMA_VERSION = 1 as const;
export const TREND_LOCAL_AUTHENTICATION_ALGORITHM = 'local-secure-mac:v1' as const;

export const TREND_ABSTENTION_REASONS = [
  'inconsistent_lighting',
  'invalid_pose',
  'insufficient_focus',
  'occlusion',
  'insufficient_interval',
  'unsupported_device',
  'invalid_capture',
  'decrypt_failure',
  'key_failure',
  'storage_failure',
  'cancelled',
  'invalid_measurement',
  'insufficient_data',
] as const;

export type TrendAbstentionReason = (typeof TREND_ABSTENTION_REASONS)[number];

type AccountBinding = Readonly<{
  accountSubject: string;
  accountGeneration: number;
  consentGeneration: number;
}>;

type BuildProvenance = Readonly<{
  applicationId: string;
  applicationVersion: string;
  nativeBuildNumber: string;
  sourceRevision: string;
  archiveDigestSha256: string;
}>;

type EngineProvenance = Readonly<{
  engineId: string;
  engineVersion: string;
  preprocessingVersion: string;
  registrationVersion: string;
  measurementVersion: string;
  calibrationVersion: string;
}>;

type DeviceProvenance = Readonly<{
  platform: 'ios';
  model: string;
  osVersion: string;
  performanceClass: string;
}>;

type TrendPhotoIdentity = Readonly<{
  photoId: string;
  captureSessionId: string;
  series: string;
  capturedAt: string;
  encryptedPayloadSha256: string;
  captureMetadataVersion: string;
  captureMetadataSha256: string;
}>;

type TrendInputPair = Readonly<{
  before: TrendPhotoIdentity;
  after: TrendPhotoIdentity;
}>;

export type TrendEngineInputV1 = Readonly<{
  schemaVersion: typeof TREND_ENGINE_INPUT_SCHEMA_VERSION;
  requestId: string;
  accountBinding: AccountBinding;
  buildProvenance: BuildProvenance;
  engineProvenance: EngineProvenance;
  deviceProvenance: DeviceProvenance;
  inputPair: TrendInputPair;
  requestedAt: string;
  expiresAt: string;
}>;

export type TrendIssuedOutcomeV1 = Readonly<{
  kind: 'issued';
  state: 'consistent' | 'change_observed';
  measurementUnit: 'normalized_absolute_delta';
  deltaMetric: number;
  mdcThreshold: number;
  analysisEvidence: Readonly<{
    normalizedInputPairSha256: string;
    decryptionAttestationSha256: string;
  }>;
  limitations: readonly string[];
}>;

export type TrendAbstainedOutcomeV1 = Readonly<{
  kind: 'abstained';
  reason: TrendAbstentionReason;
  limitations: readonly string[];
}>;

export type TrendResultOutcomeV1 = TrendIssuedOutcomeV1 | TrendAbstainedOutcomeV1;

type TrendReceiptIssuerV1 = Readonly<{
  issuerId: string;
  keyId: string;
  algorithm: typeof TREND_LOCAL_AUTHENTICATION_ALGORITHM;
  tag: string;
}>;

export type TrendResultReceiptV1 = Readonly<{
  schemaVersion: typeof TREND_RESULT_RECEIPT_SCHEMA_VERSION;
  receiptId: string;
  nonce: string;
  input: TrendEngineInputV1;
  outcome: TrendResultOutcomeV1;
  issuedAt: string;
  expiresAt: string;
  issuer: TrendReceiptIssuerV1;
}>;

export type TrendReceiptVerificationFailure =
  | 'invalid_contract'
  | 'binding_mismatch'
  | 'account_mismatch'
  | 'generation_mismatch'
  | 'not_yet_valid'
  | 'expired'
  | 'authentication_failed'
  | 'replayed'
  | 'replay_state_unavailable';

export type TrendReceiptVerification =
  | Readonly<{ ok: true; receipt: TrendResultReceiptV1 }>
  | Readonly<{ ok: false; reason: TrendReceiptVerificationFailure }>;

type VerificationContext = Readonly<{
  expectedInput: unknown;
  accountSubject: string;
  accountGeneration: number;
  consentGeneration: number;
  now: string;
  verifyAuthentication: (
    canonicalPayload: string,
    issuer: Omit<TrendReceiptIssuerV1, 'tag'>,
    tag: string,
  ) => boolean;
  consumeReplayKey: (key: string) => boolean;
}>;

type SealReceiptOptions = Readonly<{
  receiptId: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  issuerId: string;
  keyId: string;
  authenticate: (canonicalPayload: string, issuer: Omit<TrendReceiptIssuerV1, 'tag'>) => string;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;
const SOURCE_REVISION = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const OPAQUE_TOKEN = /^[A-Za-z0-9._:-]{1,160}$/u;
const AUTH_TAG = /^[A-Za-z0-9_-]{16,512}$/u;
const NONCE = /^[A-Za-z0-9_-]{16,128}$/u;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function token(value: unknown): value is string {
  return typeof value === 'string' && OPAQUE_TOKEN.test(value);
}

function isoInstant(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function generation(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function limitations(value: unknown): value is readonly string[] {
  if (
    !Array.isArray(value) ||
    value.length > 32 ||
    !value.every(
      (entry) =>
        typeof entry === 'string' &&
        entry.length > 0 &&
        entry.length <= 240 &&
        entry === entry.trim(),
    )
  ) {
    return false;
  }
  return new Set(value).size === value.length;
}

function parseAccountBinding(value: unknown): AccountBinding | null {
  const input = record(value);
  if (
    !input ||
    !exactKeys(input, ['accountSubject', 'accountGeneration', 'consentGeneration']) ||
    !token(input.accountSubject) ||
    !generation(input.accountGeneration) ||
    !generation(input.consentGeneration)
  ) {
    return null;
  }
  return {
    accountSubject: input.accountSubject,
    accountGeneration: input.accountGeneration,
    consentGeneration: input.consentGeneration,
  };
}

function parseBuildProvenance(value: unknown): BuildProvenance | null {
  const input = record(value);
  if (
    !input ||
    !exactKeys(input, [
      'applicationId',
      'applicationVersion',
      'nativeBuildNumber',
      'sourceRevision',
      'archiveDigestSha256',
    ]) ||
    !token(input.applicationId) ||
    !token(input.applicationVersion) ||
    !token(input.nativeBuildNumber) ||
    typeof input.sourceRevision !== 'string' ||
    !SOURCE_REVISION.test(input.sourceRevision) ||
    typeof input.archiveDigestSha256 !== 'string' ||
    !SHA256.test(input.archiveDigestSha256)
  ) {
    return null;
  }
  return {
    applicationId: input.applicationId,
    applicationVersion: input.applicationVersion,
    nativeBuildNumber: input.nativeBuildNumber,
    sourceRevision: input.sourceRevision,
    archiveDigestSha256: input.archiveDigestSha256,
  } as BuildProvenance;
}

function parseEngineProvenance(value: unknown): EngineProvenance | null {
  const input = record(value);
  const keys = [
    'engineId',
    'engineVersion',
    'preprocessingVersion',
    'registrationVersion',
    'measurementVersion',
    'calibrationVersion',
  ] as const;
  if (!input || !exactKeys(input, keys) || !keys.every((key) => token(input[key]))) return null;
  return {
    engineId: input.engineId,
    engineVersion: input.engineVersion,
    preprocessingVersion: input.preprocessingVersion,
    registrationVersion: input.registrationVersion,
    measurementVersion: input.measurementVersion,
    calibrationVersion: input.calibrationVersion,
  } as EngineProvenance;
}

function parseDeviceProvenance(value: unknown): DeviceProvenance | null {
  const input = record(value);
  if (
    !input ||
    !exactKeys(input, ['platform', 'model', 'osVersion', 'performanceClass']) ||
    input.platform !== 'ios' ||
    !token(input.model) ||
    !token(input.osVersion) ||
    !token(input.performanceClass)
  ) {
    return null;
  }
  return {
    platform: 'ios',
    model: input.model,
    osVersion: input.osVersion,
    performanceClass: input.performanceClass,
  } as DeviceProvenance;
}

function parsePhotoIdentity(value: unknown): TrendPhotoIdentity | null {
  const input = record(value);
  if (
    !input ||
    !exactKeys(input, [
      'photoId',
      'captureSessionId',
      'series',
      'capturedAt',
      'encryptedPayloadSha256',
      'captureMetadataVersion',
      'captureMetadataSha256',
    ]) ||
    !UUID.test(String(input.photoId)) ||
    !UUID.test(String(input.captureSessionId)) ||
    !token(input.series) ||
    !isoInstant(input.capturedAt) ||
    typeof input.encryptedPayloadSha256 !== 'string' ||
    !SHA256.test(input.encryptedPayloadSha256) ||
    !token(input.captureMetadataVersion) ||
    typeof input.captureMetadataSha256 !== 'string' ||
    !SHA256.test(input.captureMetadataSha256)
  ) {
    return null;
  }
  return {
    photoId: input.photoId as string,
    captureSessionId: input.captureSessionId as string,
    series: input.series,
    capturedAt: input.capturedAt,
    encryptedPayloadSha256: input.encryptedPayloadSha256,
    captureMetadataVersion: input.captureMetadataVersion,
    captureMetadataSha256: input.captureMetadataSha256,
  };
}

function parseAnalysisEvidence(value: unknown): TrendIssuedOutcomeV1['analysisEvidence'] | null {
  const input = record(value);
  if (
    !input ||
    !exactKeys(input, ['normalizedInputPairSha256', 'decryptionAttestationSha256']) ||
    typeof input.normalizedInputPairSha256 !== 'string' ||
    !SHA256.test(input.normalizedInputPairSha256) ||
    typeof input.decryptionAttestationSha256 !== 'string' ||
    !SHA256.test(input.decryptionAttestationSha256)
  ) {
    return null;
  }
  return {
    normalizedInputPairSha256: input.normalizedInputPairSha256,
    decryptionAttestationSha256: input.decryptionAttestationSha256,
  };
}

function parseInputPair(value: unknown): TrendInputPair | null {
  const input = record(value);
  if (!input || !exactKeys(input, ['before', 'after'])) return null;
  const before = parsePhotoIdentity(input.before);
  const after = parsePhotoIdentity(input.after);
  if (
    !before ||
    !after ||
    before.photoId === after.photoId ||
    before.captureSessionId === after.captureSessionId ||
    before.series !== after.series ||
    Date.parse(before.capturedAt) >= Date.parse(after.capturedAt)
  ) {
    return null;
  }
  return { before, after };
}

export function parseTrendEngineInputV1(value: unknown): TrendEngineInputV1 | null {
  const input = record(value);
  if (
    !input ||
    !exactKeys(input, [
      'schemaVersion',
      'requestId',
      'accountBinding',
      'buildProvenance',
      'engineProvenance',
      'deviceProvenance',
      'inputPair',
      'requestedAt',
      'expiresAt',
    ]) ||
    input.schemaVersion !== TREND_ENGINE_INPUT_SCHEMA_VERSION ||
    !UUID.test(String(input.requestId)) ||
    !isoInstant(input.requestedAt) ||
    !isoInstant(input.expiresAt) ||
    Date.parse(input.requestedAt) >= Date.parse(input.expiresAt)
  ) {
    return null;
  }
  const accountBinding = parseAccountBinding(input.accountBinding);
  const buildProvenance = parseBuildProvenance(input.buildProvenance);
  const engineProvenance = parseEngineProvenance(input.engineProvenance);
  const deviceProvenance = parseDeviceProvenance(input.deviceProvenance);
  const inputPair = parseInputPair(input.inputPair);
  if (!accountBinding || !buildProvenance || !engineProvenance || !deviceProvenance || !inputPair) {
    return null;
  }
  return {
    schemaVersion: TREND_ENGINE_INPUT_SCHEMA_VERSION,
    requestId: input.requestId as string,
    accountBinding,
    buildProvenance,
    engineProvenance,
    deviceProvenance,
    inputPair,
    requestedAt: input.requestedAt,
    expiresAt: input.expiresAt,
  };
}

function parseOutcome(value: unknown): TrendResultOutcomeV1 | null {
  const input = record(value);
  if (!input || !limitations(input.limitations)) return null;
  if (input.kind === 'issued') {
    if (
      !exactKeys(input, [
        'kind',
        'state',
        'measurementUnit',
        'deltaMetric',
        'mdcThreshold',
        'analysisEvidence',
        'limitations',
      ]) ||
      (input.state !== 'consistent' && input.state !== 'change_observed') ||
      input.measurementUnit !== 'normalized_absolute_delta' ||
      typeof input.deltaMetric !== 'number' ||
      !Number.isFinite(input.deltaMetric) ||
      input.deltaMetric < 0 ||
      input.deltaMetric > 1 ||
      typeof input.mdcThreshold !== 'number' ||
      !Number.isFinite(input.mdcThreshold) ||
      input.mdcThreshold <= 0 ||
      input.mdcThreshold > 1 ||
      !parseAnalysisEvidence(input.analysisEvidence) ||
      (input.state === 'consistent' && input.deltaMetric >= input.mdcThreshold) ||
      (input.state === 'change_observed' && input.deltaMetric < input.mdcThreshold)
    ) {
      return null;
    }
    const analysisEvidence = parseAnalysisEvidence(input.analysisEvidence)!;
    return {
      kind: 'issued',
      state: input.state,
      measurementUnit: input.measurementUnit,
      deltaMetric: input.deltaMetric,
      mdcThreshold: input.mdcThreshold,
      analysisEvidence,
      limitations: [...input.limitations],
    };
  }
  if (
    input.kind === 'abstained' &&
    exactKeys(input, ['kind', 'reason', 'limitations']) &&
    TREND_ABSTENTION_REASONS.includes(input.reason as TrendAbstentionReason)
  ) {
    return {
      kind: 'abstained',
      reason: input.reason as TrendAbstentionReason,
      limitations: [...input.limitations],
    };
  }
  return null;
}

function parseIssuer(value: unknown): TrendReceiptIssuerV1 | null {
  const input = record(value);
  if (
    !input ||
    !exactKeys(input, ['issuerId', 'keyId', 'algorithm', 'tag']) ||
    !token(input.issuerId) ||
    !token(input.keyId) ||
    input.algorithm !== TREND_LOCAL_AUTHENTICATION_ALGORITHM ||
    typeof input.tag !== 'string' ||
    !AUTH_TAG.test(input.tag)
  ) {
    return null;
  }
  return {
    issuerId: input.issuerId,
    keyId: input.keyId,
    algorithm: TREND_LOCAL_AUTHENTICATION_ALGORITHM,
    tag: input.tag,
  };
}

export function parseTrendResultReceiptV1(value: unknown): TrendResultReceiptV1 | null {
  const input = record(value);
  if (
    !input ||
    !exactKeys(input, [
      'schemaVersion',
      'receiptId',
      'nonce',
      'input',
      'outcome',
      'issuedAt',
      'expiresAt',
      'issuer',
    ]) ||
    input.schemaVersion !== TREND_RESULT_RECEIPT_SCHEMA_VERSION ||
    !UUID.test(String(input.receiptId)) ||
    typeof input.nonce !== 'string' ||
    !NONCE.test(input.nonce) ||
    !isoInstant(input.issuedAt) ||
    !isoInstant(input.expiresAt)
  ) {
    return null;
  }
  const parsedInput = parseTrendEngineInputV1(input.input);
  const outcome = parseOutcome(input.outcome);
  const issuer = parseIssuer(input.issuer);
  if (
    !parsedInput ||
    !outcome ||
    !issuer ||
    Date.parse(input.issuedAt) < Date.parse(parsedInput.requestedAt) ||
    Date.parse(input.issuedAt) >= Date.parse(input.expiresAt) ||
    Date.parse(input.expiresAt) > Date.parse(parsedInput.expiresAt)
  ) {
    return null;
  }
  return {
    schemaVersion: TREND_RESULT_RECEIPT_SCHEMA_VERSION,
    receiptId: input.receiptId as string,
    nonce: input.nonce,
    input: parsedInput,
    outcome,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    issuer,
  };
}

function unsignedReceipt(receipt: TrendResultReceiptV1) {
  return {
    schemaVersion: receipt.schemaVersion,
    receiptId: receipt.receiptId,
    nonce: receipt.nonce,
    input: receipt.input,
    outcome: receipt.outcome,
    issuedAt: receipt.issuedAt,
    expiresAt: receipt.expiresAt,
    issuer: {
      issuerId: receipt.issuer.issuerId,
      keyId: receipt.issuer.keyId,
      algorithm: receipt.issuer.algorithm,
    },
  };
}

export function canonicalTrendReceiptPayloadV1(receipt: TrendResultReceiptV1): string {
  return JSON.stringify(unsignedReceipt(receipt));
}

function canonicalTrendEngineInputV1(input: TrendEngineInputV1): string {
  return JSON.stringify(input);
}

export function sealTrendResultReceiptV1(
  inputValue: unknown,
  outcomeValue: unknown,
  options: SealReceiptOptions,
): TrendResultReceiptV1 | null {
  const input = parseTrendEngineInputV1(inputValue);
  const outcome = parseOutcome(outcomeValue);
  if (!input || !outcome) return null;
  const unsigned: TrendResultReceiptV1 = {
    schemaVersion: TREND_RESULT_RECEIPT_SCHEMA_VERSION,
    receiptId: options.receiptId,
    nonce: options.nonce,
    input,
    outcome,
    issuedAt: options.issuedAt,
    expiresAt: options.expiresAt,
    issuer: {
      issuerId: options.issuerId,
      keyId: options.keyId,
      algorithm: TREND_LOCAL_AUTHENTICATION_ALGORITHM,
      tag: '________________',
    },
  };
  const candidate = parseTrendResultReceiptV1(unsigned);
  if (!candidate) return null;
  const issuer = unsignedReceipt(candidate).issuer;
  try {
    const tag = options.authenticate(canonicalTrendReceiptPayloadV1(candidate), issuer);
    return parseTrendResultReceiptV1({ ...candidate, issuer: { ...issuer, tag } });
  } catch {
    return null;
  }
}

export function verifyTrendResultReceiptV1(
  value: unknown,
  context: VerificationContext,
): TrendReceiptVerification {
  const receipt = parseTrendResultReceiptV1(value);
  const expectedInput = parseTrendEngineInputV1(context.expectedInput);
  if (!receipt || !expectedInput || !isoInstant(context.now)) {
    return { ok: false, reason: 'invalid_contract' };
  }
  if (canonicalTrendEngineInputV1(receipt.input) !== canonicalTrendEngineInputV1(expectedInput)) {
    return { ok: false, reason: 'binding_mismatch' };
  }
  const binding = receipt.input.accountBinding;
  if (binding.accountSubject !== context.accountSubject) {
    return { ok: false, reason: 'account_mismatch' };
  }
  if (
    binding.accountGeneration !== context.accountGeneration ||
    binding.consentGeneration !== context.consentGeneration
  ) {
    return { ok: false, reason: 'generation_mismatch' };
  }
  const now = Date.parse(context.now);
  if (now < Date.parse(receipt.issuedAt)) return { ok: false, reason: 'not_yet_valid' };
  if (now >= Date.parse(receipt.expiresAt)) return { ok: false, reason: 'expired' };
  const issuer = {
    issuerId: receipt.issuer.issuerId,
    keyId: receipt.issuer.keyId,
    algorithm: receipt.issuer.algorithm,
  };
  let authenticated = false;
  try {
    authenticated = context.verifyAuthentication(
      canonicalTrendReceiptPayloadV1(receipt),
      issuer,
      receipt.issuer.tag,
    );
  } catch {
    authenticated = false;
  }
  if (!authenticated) {
    return { ok: false, reason: 'authentication_failed' };
  }
  try {
    if (!context.consumeReplayKey(`${receipt.receiptId}:${receipt.nonce}`)) {
      return { ok: false, reason: 'replayed' };
    }
  } catch {
    return { ok: false, reason: 'replay_state_unavailable' };
  }
  return { ok: true, receipt };
}
