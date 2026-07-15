export const SUPABASE_REMOTE_REQUEST_BODY_MAX_CHARS = 16_384;
export const SUPABASE_REMOTE_RESPONSE_MAX_BYTES = 16 * 1024 * 1024;

const SUPABASE_CONTROL_RESPONSE_MAX_BYTES = 128 * 1024;
const AUTH_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const JWT_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;
const JWT_MAX_CHARS = 16_384;
const JWT_PAYLOAD_MAX_CHARS = 8_192;
const REFRESH_TOKEN_MAX_CHARS = 16_384;
const UNRESERVED_CHARACTER = /^[A-Za-z0-9._~-]$/;
const MINIMUM_PERMIT_TIMEOUT_MS = 10;
const MAXIMUM_PERMIT_TIMEOUT_MS = 120_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

export type SupabaseRemoteRequestState = 'closed' | 'candidate' | 'active' | 'deletion';

export type SupabaseRemoteRequestTarget =
  | 'external'
  | 'auth'
  | 'rest'
  | 'storage'
  | 'graphql'
  | 'realtime'
  | 'functions'
  | 'account_deletion'
  | 'unknown';

export type SupabaseAccountDeletionAction =
  | 'preflight'
  | 'begin'
  | 'status'
  | 'publication_reserve'
  | 'publication_activate'
  | 'publication_renew'
  | 'publication_release';

export type SupabaseRemoteRequestPermit =
  | Readonly<{ purpose: 'auth_fresh_sign_in'; timeoutMs?: number }>
  | Readonly<{
      purpose: 'auth_refresh';
      binding: SupabaseRemoteSessionBinding;
      /** The exact opaque refresh credential expected in every retry body. */
      refreshToken: string;
      timeoutMs?: number;
    }>
  | Readonly<{
      purpose: 'auth_verify' | 'auth_logout' | 'auth_identity_upgrade';
      binding: SupabaseRemoteSessionBinding;
      timeoutMs?: number;
    }>
  | Readonly<{
      purpose: 'account_deletion';
      action: SupabaseAccountDeletionAction;
      binding?: SupabaseRemoteSessionBinding;
      timeoutMs?: number;
    }>;

export type SupabaseRemoteRequestSnapshot = Readonly<{
  state: SupabaseRemoteRequestState;
  generation: number;
  subject: string | null;
  sessionId: string | null;
  /** Includes request transports and the semantic operations enclosing permits. */
  inFlight: number;
  /** Timed-out work that still has not truly settled. Reopening remains blocked. */
  quarantined: number;
}>;

export type SupabaseRemoteSessionBinding = Readonly<{
  subject: string;
  sessionId: string;
  accessToken: string;
}>;

export type SupabaseRemoteRequestDescriptor = Readonly<{
  input: string | URL | Request;
  init?: RequestInit;
}>;

export type SupabaseRemoteRequestTransport = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type SupabaseRemoteRequestAdmissionOptions = Readonly<{
  /** Exact project publishable key used by unauthenticated Auth requests. */
  publicAuthorizationToken?: string;
}>;

export type SupabaseRemoteRequestAdmissionErrorCode =
  | 'SUPABASE_REMOTE_REQUEST_ADMISSION_CLOSED'
  | 'SUPABASE_REMOTE_REQUEST_BINDING_REJECTED'
  | 'SUPABASE_REMOTE_REQUEST_DRAIN_QUARANTINED'
  | 'SUPABASE_REMOTE_REQUEST_PERMIT_REJECTED'
  | 'SUPABASE_REMOTE_REQUEST_RESULT_STALE'
  | 'SUPABASE_REMOTE_REQUEST_TARGET_REJECTED';

export class SupabaseRemoteRequestAdmissionError extends Error {
  constructor(readonly code: SupabaseRemoteRequestAdmissionErrorCode) {
    super(code);
    this.name = 'SupabaseRemoteRequestAdmissionError';
  }
}

type BoundState = {
  kind: Exclude<SupabaseRemoteRequestState, 'closed'>;
  generation: number;
  binding: SupabaseRemoteSessionBinding;
};

type InternalState = { kind: 'closed'; generation: number } | BoundState;

type StrictUrl = Readonly<{
  url: URL;
  path: string;
  rawQuery: string;
}>;

type CanonicalRequestSnapshot = Readonly<{
  request: Request;
  strictUrl: StrictUrl;
  target: SupabaseRemoteRequestTarget;
  method: string;
  headers: readonly (readonly [string, string])[];
  callerSignal: AbortSignal;
  generation: number;
  permitEpoch: number;
  permitScope: PermitScope | null;
}>;

type PermitScope = {
  readonly epoch: number;
  readonly generation: number;
  readonly permit: SupabaseRemoteRequestPermit;
  readonly lease: TrackedLease;
  requestCount: number;
  nextBinding: SupabaseRemoteSessionBinding | null;
  expired: boolean;
};

type TrackedLease = {
  readonly controller: AbortController;
  readonly generation: number;
  readonly settlement: Promise<void>;
  readonly drainSettlement: Promise<void>;
  readonly children: Set<TrackedLease>;
  readonly parent: TrackedLease | null;
  quarantined: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  settle: () => void;
  quarantine: () => void;
};

type CombinedSignal = {
  signal: AbortSignal;
  cleanup: () => void;
};

type AuthRequestPurpose =
  | 'auth_fresh_sign_in'
  | 'auth_refresh'
  | 'auth_verify'
  | 'auth_logout'
  | 'auth_identity_upgrade'
  | 'other';

type Authorization = Readonly<{
  generation: number;
  scope: PermitScope | null;
  authPurpose: AuthRequestPurpose;
}>;

type BufferedResponse = Readonly<{
  response: Response;
  bytes: Uint8Array;
}>;

function admissionError(
  code: SupabaseRemoteRequestAdmissionErrorCode,
): SupabaseRemoteRequestAdmissionError {
  return new SupabaseRemoteRequestAdmissionError(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sameSessionIdentity(
  left: Pick<SupabaseRemoteSessionBinding, 'subject' | 'sessionId'>,
  right: Pick<SupabaseRemoteSessionBinding, 'subject' | 'sessionId'>,
): boolean {
  return left.subject === right.subject && left.sessionId === right.sessionId;
}

function exactBinding(
  left: SupabaseRemoteSessionBinding,
  right: SupabaseRemoteSessionBinding,
): boolean {
  return sameSessionIdentity(left, right) && left.accessToken === right.accessToken;
}

function normalizedPort(url: URL): string {
  if (url.port.length > 0) return url.port;
  return url.protocol === 'https:' ? '443' : '80';
}

function rawPathAndQuery(rawUrl: string): { path: string; query: string } | null {
  const schemeEnd = rawUrl.indexOf('://');
  if (schemeEnd <= 0) return null;
  const authorityStart = schemeEnd + 3;
  const pathStart = rawUrl.indexOf('/', authorityStart);
  const queryStart = rawUrl.indexOf('?', authorityStart);
  const hashStart = rawUrl.indexOf('#', authorityStart);
  const firstSuffix = [pathStart, queryStart, hashStart]
    .filter((index) => index >= 0)
    .reduce((lowest, index) => Math.min(lowest, index), rawUrl.length);
  const pathEndCandidates = [queryStart, hashStart].filter(
    (index) => index >= 0 && index >= firstSuffix,
  );
  const pathEnd = pathEndCandidates.reduce(
    (lowest, index) => Math.min(lowest, index),
    rawUrl.length,
  );
  const path = pathStart === firstSuffix ? rawUrl.slice(pathStart, pathEnd) : '/';
  if (queryStart < 0 || (hashStart >= 0 && queryStart > hashStart)) return { path, query: '' };
  return {
    path,
    query: rawUrl.slice(queryStart + 1, hashStart >= 0 ? hashStart : rawUrl.length),
  };
}

function decodePercentEncodedUtf8(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function hasCanonicalPercentEncoding(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '%') continue;
    const pair = value.slice(index + 1, index + 3);
    if (!/^[0-9A-F]{2}$/.test(pair)) return false;
    index += 2;
  }
  return true;
}

function strictCanonicalPath(rawPath: string, parsedPath: string): string | null {
  if (
    rawPath.length === 0 ||
    rawPath !== parsedPath ||
    rawPath.includes('\\') ||
    rawPath.includes('//') ||
    !hasCanonicalPercentEncoding(rawPath)
  ) {
    return null;
  }
  for (let index = 0; index < rawPath.length; index += 1) {
    if (rawPath[index] !== '%') continue;
    const decodedCode = Number.parseInt(rawPath.slice(index + 1, index + 3), 16);
    const decodedCharacter = String.fromCharCode(decodedCode);
    if (
      decodedCharacter === '/' ||
      decodedCharacter === '\\' ||
      decodedCharacter === '%' ||
      decodedCharacter === '.' ||
      UNRESERVED_CHARACTER.test(decodedCharacter)
    ) {
      return null;
    }
    index += 2;
  }
  const decoded = decodePercentEncodedUtf8(rawPath);
  if (
    decoded === null ||
    decoded.includes('\\') ||
    decoded.includes('//') ||
    /%[0-9A-Fa-f]{2}/.test(decoded) ||
    /[\u0000-\u001f\u007f]/.test(decoded) ||
    decoded.split('/').some((segment) => segment === '.' || segment === '..')
  ) {
    return null;
  }
  return decoded;
}

function parseStrictAbsoluteUrl(rawUrl: string): StrictUrl | null {
  if (
    rawUrl.length === 0 ||
    rawUrl !== rawUrl.trim() ||
    rawUrl.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(rawUrl)
  ) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (
    (url.protocol !== 'https:' && url.protocol !== 'http:') ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.hash.length > 0 ||
    url.hostname.length === 0 ||
    url.hostname.endsWith('.')
  ) {
    return null;
  }
  const canonicalPrefix = `${url.protocol}//${url.host}`;
  if (!rawUrl.startsWith(canonicalPrefix)) return null;
  const suffix = rawUrl[canonicalPrefix.length];
  if (suffix !== undefined && suffix !== '/' && suffix !== '?') return null;
  const raw = rawPathAndQuery(rawUrl);
  if (raw === null || !hasCanonicalPercentEncoding(raw.query)) return null;
  const decodedQuery = decodePercentEncodedUtf8(raw.query.replaceAll('+', '%20'));
  if (
    decodedQuery === null ||
    decodedQuery.includes('\\') ||
    /%[0-9A-Fa-f]{2}/.test(decodedQuery) ||
    /[\u0000-\u001f\u007f]/.test(decodedQuery)
  ) {
    return null;
  }
  const path = strictCanonicalPath(raw.path, url.pathname);
  return path === null ? null : Object.freeze({ url, path, rawQuery: raw.query });
}

function configuredOrigin(input: string | URL): URL | null {
  const raw = input instanceof URL ? input.href : input;
  const strict = parseStrictAbsoluteUrl(raw);
  if (
    strict === null ||
    strict.path !== '/' ||
    strict.rawQuery.length > 0 ||
    strict.url.search.length > 0
  ) {
    return null;
  }
  return strict.url;
}

function sameSupabaseOrigin(url: URL, origin: URL): boolean {
  return (
    url.protocol === origin.protocol &&
    url.hostname === origin.hostname &&
    normalizedPort(url) === normalizedPort(origin)
  );
}

function classifyStrictUrl(strict: StrictUrl, origin: URL): SupabaseRemoteRequestTarget {
  if (!sameSupabaseOrigin(strict.url, origin)) return 'external';
  const path = strict.path;
  if (path === '/auth/v1' || path.startsWith('/auth/v1/')) return 'auth';
  if (path === '/rest/v1' || path.startsWith('/rest/v1/')) return 'rest';
  if (path === '/storage/v1' || path.startsWith('/storage/v1/')) return 'storage';
  if (path === '/graphql/v1' || path.startsWith('/graphql/v1/')) return 'graphql';
  if (path === '/realtime/v1' || path.startsWith('/realtime/v1/')) return 'realtime';
  if (path === '/functions/v1/account-deletion') return 'account_deletion';
  if (path === '/functions/v1' || path.startsWith('/functions/v1/')) return 'functions';
  return 'unknown';
}

function readBearer(headers: readonly (readonly [string, string])[]): string | null {
  const authorization = headers.find(([key]) => key === 'authorization')?.[1];
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length);
  return token.length > 0 && token === token.trim() ? token : null;
}

function isBoundedRequiredString(value: unknown, maximum = SUPABASE_REMOTE_REQUEST_BODY_MAX_CHARS) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maximum &&
    value === value.trim()
  );
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  required: readonly string[] = [],
): boolean {
  const allowedSet = new Set(allowed);
  return (
    Object.keys(value).every((key) => allowedSet.has(key)) &&
    required.every((key) => Object.hasOwn(value, key))
  );
}

function validSecurityMetadata(value: unknown): boolean {
  return (
    value === undefined ||
    (isRecord(value) &&
      hasOnlyKeys(value, ['captcha_token']) &&
      (value.captcha_token === undefined || isBoundedRequiredString(value.captcha_token)))
  );
}

function parseJsonRecord(body: string | null): Record<string, unknown> | null {
  if (body === null || body.length === 0 || body.length > SUPABASE_REMOTE_REQUEST_BODY_MAX_CHARS) {
    return null;
  }
  try {
    const parsed = JSON.parse(body) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function hasDuplicateSecurityProperty(body: string): boolean {
  const securityKeys = [
    'action',
    'refresh_token',
    'link_identity',
    'type',
    'provider',
    'email',
    'token',
  ];
  return securityKeys.some((key) => {
    const matches = body.match(new RegExp(`"${key}"\\s*:`, 'g'));
    return (matches?.length ?? 0) > 1;
  });
}

function isAnonymousSignInBody(body: Record<string, unknown>): boolean {
  return (
    hasOnlyKeys(body, ['data', 'gotrue_meta_security'], ['data', 'gotrue_meta_security']) &&
    isRecord(body.data) &&
    validSecurityMetadata(body.gotrue_meta_security)
  );
}

function isEmailOtpBody(body: Record<string, unknown>): boolean {
  return (
    hasOnlyKeys(
      body,
      [
        'email',
        'data',
        'create_user',
        'gotrue_meta_security',
        'code_challenge',
        'code_challenge_method',
      ],
      ['email', 'data', 'create_user', 'gotrue_meta_security'],
    ) &&
    isBoundedRequiredString(body.email) &&
    isRecord(body.data) &&
    body.create_user === true &&
    validSecurityMetadata(body.gotrue_meta_security) &&
    (body.code_challenge === undefined ||
      body.code_challenge === null ||
      isBoundedRequiredString(body.code_challenge)) &&
    (body.code_challenge_method === undefined ||
      body.code_challenge_method === null ||
      body.code_challenge_method === 's256')
  );
}

function isProviderTokenBody(body: Record<string, unknown>, requireIdentityLink: boolean): boolean {
  return (
    hasOnlyKeys(
      body,
      ['provider', 'id_token', 'access_token', 'nonce', 'link_identity', 'gotrue_meta_security'],
      requireIdentityLink
        ? ['provider', 'id_token', 'link_identity', 'gotrue_meta_security']
        : ['provider', 'id_token', 'gotrue_meta_security'],
    ) &&
    (body.provider === 'apple' || body.provider === 'google') &&
    isBoundedRequiredString(body.id_token) &&
    (body.access_token === undefined || isBoundedRequiredString(body.access_token)) &&
    (body.nonce === undefined || isBoundedRequiredString(body.nonce)) &&
    (requireIdentityLink ? body.link_identity === true : body.link_identity === undefined) &&
    validSecurityMetadata(body.gotrue_meta_security)
  );
}

function isOtpVerificationBody(
  body: Record<string, unknown>,
  type: 'email' | 'email_change',
): boolean {
  return (
    hasOnlyKeys(
      body,
      ['email', 'token', 'type', 'gotrue_meta_security'],
      ['email', 'token', 'type', 'gotrue_meta_security'],
    ) &&
    body.type === type &&
    isBoundedRequiredString(body.email) &&
    isBoundedRequiredString(body.token) &&
    validSecurityMetadata(body.gotrue_meta_security)
  );
}

function isEmailUpgradeBody(body: Record<string, unknown>): boolean {
  return (
    hasOnlyKeys(body, ['email', 'code_challenge', 'code_challenge_method'], ['email']) &&
    isBoundedRequiredString(body.email) &&
    (body.code_challenge === undefined ||
      body.code_challenge === null ||
      isBoundedRequiredString(body.code_challenge)) &&
    (body.code_challenge_method === undefined ||
      body.code_challenge_method === null ||
      body.code_challenge_method === 's256')
  );
}

function classifyAuthRequest(
  strictUrl: StrictUrl,
  method: string,
  bodyText: string | null,
): AuthRequestPurpose {
  const { path, rawQuery } = strictUrl;
  if (bodyText !== null && hasDuplicateSecurityProperty(bodyText)) return 'other';
  const body = bodyText === null || bodyText.length === 0 ? null : parseJsonRecord(bodyText);

  if (method === 'GET' && path === '/auth/v1/user' && rawQuery === '' && body === null) {
    return 'auth_verify';
  }
  if (
    method === 'POST' &&
    path === '/auth/v1/logout' &&
    rawQuery === 'scope=global' &&
    body === null
  ) {
    return 'auth_logout';
  }
  if (
    method === 'POST' &&
    path === '/auth/v1/token' &&
    rawQuery === 'grant_type=refresh_token' &&
    body !== null &&
    hasOnlyKeys(body, ['refresh_token'], ['refresh_token']) &&
    isBoundedRequiredString(body.refresh_token, REFRESH_TOKEN_MAX_CHARS)
  ) {
    return 'auth_refresh';
  }
  if (
    method === 'POST' &&
    path === '/auth/v1/token' &&
    rawQuery === 'grant_type=id_token' &&
    body !== null
  ) {
    if (isProviderTokenBody(body, true)) return 'auth_identity_upgrade';
    if (isProviderTokenBody(body, false)) return 'auth_fresh_sign_in';
    return 'other';
  }
  if (
    method === 'PUT' &&
    path === '/auth/v1/user' &&
    rawQuery === '' &&
    body !== null &&
    isEmailUpgradeBody(body)
  ) {
    return 'auth_identity_upgrade';
  }
  if (method === 'POST' && path === '/auth/v1/verify' && rawQuery === '' && body !== null) {
    if (isOtpVerificationBody(body, 'email_change')) return 'auth_identity_upgrade';
    if (isOtpVerificationBody(body, 'email')) return 'auth_fresh_sign_in';
    return 'other';
  }
  if (
    method === 'POST' &&
    path === '/auth/v1/signup' &&
    rawQuery === '' &&
    body !== null &&
    isAnonymousSignInBody(body)
  ) {
    return 'auth_fresh_sign_in';
  }
  if (
    method === 'POST' &&
    path === '/auth/v1/otp' &&
    rawQuery === '' &&
    body !== null &&
    isEmailOtpBody(body)
  ) {
    return 'auth_fresh_sign_in';
  }
  return 'other';
}

function parseDeletionAction(bodyText: string | null): string | null {
  if (bodyText === null || hasDuplicateSecurityProperty(bodyText)) return null;
  const body = parseJsonRecord(bodyText);
  return body !== null && typeof body.action === 'string' ? body.action : null;
}

function combineAbortSignals(gateSignal: AbortSignal, callerSignal: AbortSignal): CombinedSignal {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (gateSignal.aborted || callerSignal.aborted) {
    abort();
    return { signal: controller.signal, cleanup: () => {} };
  }
  gateSignal.addEventListener('abort', abort, { once: true });
  callerSignal.addEventListener('abort', abort, { once: true });
  return {
    signal: controller.signal,
    cleanup: () => {
      gateSignal.removeEventListener('abort', abort);
      callerSignal.removeEventListener('abort', abort);
    },
  };
}

function rawUrlForInput(input: string | URL | Request): string {
  if (typeof input === 'string') return input;
  return input instanceof Request ? input.url : input.href;
}

function captureCanonicalRequest(
  descriptor: SupabaseRemoteRequestDescriptor,
  origin: URL,
  generation: number,
  permitEpoch: number,
  permitScope: PermitScope | null,
): CanonicalRequestSnapshot {
  const rawUrl = rawUrlForInput(descriptor.input);
  const strictUrl = parseStrictAbsoluteUrl(rawUrl);
  if (strictUrl === null) throw admissionError('SUPABASE_REMOTE_REQUEST_TARGET_REJECTED');
  let request: Request;
  try {
    const initial = new Request(descriptor.input, descriptor.init);
    request = new Request(initial, { redirect: 'manual' });
  } catch {
    throw admissionError('SUPABASE_REMOTE_REQUEST_TARGET_REJECTED');
  }
  if (request.url !== strictUrl.url.href) {
    throw admissionError('SUPABASE_REMOTE_REQUEST_TARGET_REJECTED');
  }
  const headers = Object.freeze(
    [...request.headers.entries()].map(([key, value]) => Object.freeze([key, value] as const)),
  );
  return Object.freeze({
    request,
    strictUrl,
    target: classifyStrictUrl(strictUrl, origin),
    method: request.method.toUpperCase(),
    headers,
    callerSignal: request.signal,
    generation,
    permitEpoch,
    permitScope,
  });
}

function decodeBase64Url(segment: string): Uint8Array | null {
  if (
    segment.length === 0 ||
    segment.length > JWT_PAYLOAD_MAX_CHARS ||
    segment.length % 4 === 1 ||
    !JWT_SEGMENT_PATTERN.test(segment)
  ) {
    return null;
  }
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const output = new Uint8Array(Math.floor((segment.length * 6) / 8));
  let accumulator = 0;
  let bitCount = 0;
  let outputIndex = 0;
  for (const character of segment) {
    const value = alphabet.indexOf(character);
    if (value < 0) return null;
    accumulator = (accumulator << 6) | value;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      output[outputIndex] = (accumulator >> bitCount) & 0xff;
      outputIndex += 1;
      accumulator &= (1 << bitCount) - 1;
    }
  }
  if (bitCount > 0 && accumulator !== 0) return null;
  return outputIndex === output.length ? output : null;
}

function decodeUtf8(bytes: Uint8Array): string | null {
  const characters: string[] = [];
  for (let index = 0; index < bytes.length; ) {
    const first = bytes[index]!;
    if (first <= 0x7f) {
      characters.push(String.fromCharCode(first));
      index += 1;
      continue;
    }
    let codePoint: number;
    let continuationCount: number;
    let minimum: number;
    if (first >= 0xc2 && first <= 0xdf) {
      codePoint = first & 0x1f;
      continuationCount = 1;
      minimum = 0x80;
    } else if (first >= 0xe0 && first <= 0xef) {
      codePoint = first & 0x0f;
      continuationCount = 2;
      minimum = 0x800;
    } else if (first >= 0xf0 && first <= 0xf4) {
      codePoint = first & 0x07;
      continuationCount = 3;
      minimum = 0x10000;
    } else {
      return null;
    }
    if (index + continuationCount >= bytes.length) return null;
    for (let offset = 1; offset <= continuationCount; offset += 1) {
      const continuation = bytes[index + offset]!;
      if ((continuation & 0xc0) !== 0x80) return null;
      codePoint = (codePoint << 6) | (continuation & 0x3f);
    }
    if (
      codePoint < minimum ||
      codePoint > 0x10ffff ||
      (codePoint >= 0xd800 && codePoint <= 0xdfff)
    ) {
      return null;
    }
    characters.push(String.fromCodePoint(codePoint));
    index += continuationCount + 1;
  }
  return characters.join('');
}

/**
 * Decode only the two server-issued claims needed for process-local binding.
 * This is deliberately not JWT signature verification; Supabase remains the
 * authority. Malformed and non-canonical payloads fail closed without relying
 * on browser-only `atob`.
 */
export function parseSupabaseRemoteSessionBinding(
  accessToken: unknown,
  expectedSubject: unknown,
): SupabaseRemoteSessionBinding | null {
  if (
    typeof accessToken !== 'string' ||
    accessToken.length === 0 ||
    accessToken.length > JWT_MAX_CHARS ||
    accessToken !== accessToken.trim() ||
    typeof expectedSubject !== 'string' ||
    !AUTH_UUID_PATTERN.test(expectedSubject)
  ) {
    return null;
  }
  const segments = accessToken.split('.');
  if (segments.length !== 3 || segments.some((segment) => !JWT_SEGMENT_PATTERN.test(segment))) {
    return null;
  }
  const payloadBytes = decodeBase64Url(segments[1]!);
  if (payloadBytes === null) return null;
  const decoded = decodeUtf8(payloadBytes);
  if (decoded === null) return null;
  try {
    const payload = JSON.parse(decoded) as unknown;
    if (
      !isRecord(payload) ||
      payload.sub !== expectedSubject ||
      typeof payload.sub !== 'string' ||
      !AUTH_UUID_PATTERN.test(payload.sub) ||
      typeof payload.session_id !== 'string' ||
      !AUTH_UUID_PATTERN.test(payload.session_id)
    ) {
      return null;
    }
    return Object.freeze({
      subject: payload.sub,
      sessionId: payload.session_id,
      accessToken,
    });
  } catch {
    return null;
  }
}

export function classifySupabaseRemoteTarget(
  input: string | URL,
  configuredSupabaseUrl: string | URL,
): SupabaseRemoteRequestTarget {
  const origin = configuredOrigin(configuredSupabaseUrl);
  const raw = input instanceof URL ? input.href : input;
  const strict = parseStrictAbsoluteUrl(raw);
  if (origin === null || strict === null) return 'unknown';
  return classifyStrictUrl(strict, origin);
}

function validateBinding(binding: SupabaseRemoteSessionBinding): SupabaseRemoteSessionBinding {
  const parsed = parseSupabaseRemoteSessionBinding(binding.accessToken, binding.subject);
  if (parsed === null || !exactBinding(parsed, binding)) {
    throw admissionError('SUPABASE_REMOTE_REQUEST_BINDING_REJECTED');
  }
  return parsed;
}

function authenticatedDeletionAction(action: SupabaseAccountDeletionAction): boolean {
  return action !== 'status' && action !== 'publication_release';
}

function defaultPermitTimeoutMs(permit: SupabaseRemoteRequestPermit): number {
  if (permit.purpose === 'auth_refresh' || permit.purpose === 'auth_verify') return 15_000;
  if (permit.purpose === 'auth_logout') return 15_000;
  if (permit.purpose === 'account_deletion' && permit.action === 'status') return 15_000;
  return 30_000;
}

function validatedPermitTimeoutMs(permit: SupabaseRemoteRequestPermit): number {
  const timeout = permit.timeoutMs ?? defaultPermitTimeoutMs(permit);
  if (
    !Number.isSafeInteger(timeout) ||
    timeout < MINIMUM_PERMIT_TIMEOUT_MS ||
    timeout > MAXIMUM_PERMIT_TIMEOUT_MS
  ) {
    throw admissionError('SUPABASE_REMOTE_REQUEST_PERMIT_REJECTED');
  }
  return timeout;
}

function snapshotPermit(permit: SupabaseRemoteRequestPermit): SupabaseRemoteRequestPermit {
  const timeoutMs = validatedPermitTimeoutMs(permit);
  if (permit.purpose === 'auth_fresh_sign_in') {
    return Object.freeze({ ...permit, timeoutMs });
  }
  if (permit.purpose === 'account_deletion') {
    return Object.freeze({
      purpose: permit.purpose,
      action: permit.action,
      timeoutMs,
      ...(permit.binding === undefined ? {} : { binding: validateBinding(permit.binding) }),
    });
  }
  const binding = validateBinding(permit.binding);
  if (permit.purpose === 'auth_refresh') {
    if (!isBoundedRequiredString(permit.refreshToken, REFRESH_TOKEN_MAX_CHARS)) {
      throw admissionError('SUPABASE_REMOTE_REQUEST_PERMIT_REJECTED');
    }
    return Object.freeze({ ...permit, binding, refreshToken: permit.refreshToken, timeoutMs });
  }
  return Object.freeze({ ...permit, binding, timeoutMs });
}

async function readBodyBytes(body: Request | Response, maximumBytes: number): Promise<Uint8Array> {
  const contentLength = body.headers.get('content-length');
  if (contentLength !== null) {
    const parsed = Number(contentLength);
    if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > maximumBytes) {
      throw admissionError('SUPABASE_REMOTE_REQUEST_TARGET_REJECTED');
    }
  }
  const stream = body.body;
  if (stream === null) return new Uint8Array();
  // Some React Native fetch polyfills expose `body` as undefined while still
  // implementing arrayBuffer(). Do not mistake that for an empty response.
  if (stream !== undefined && typeof stream.getReader === 'function') {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        const chunk = next.value;
        length += chunk.byteLength;
        if (length > maximumBytes) {
          await reader.cancel();
          throw admissionError('SUPABASE_REMOTE_REQUEST_TARGET_REJECTED');
        }
        chunks.push(chunk);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  }
  const bytes = new Uint8Array(await body.arrayBuffer());
  if (bytes.byteLength > maximumBytes) {
    throw admissionError('SUPABASE_REMOTE_REQUEST_TARGET_REJECTED');
  }
  return bytes;
}

async function readBoundedRequestBody(request: Request): Promise<string | null> {
  if (request.body === null) return null;
  const bytes = await readBodyBytes(request.clone(), SUPABASE_REMOTE_REQUEST_BODY_MAX_CHARS);
  const decoded = decodeUtf8(bytes);
  if (decoded === null || decoded.length > SUPABASE_REMOTE_REQUEST_BODY_MAX_CHARS) {
    throw admissionError('SUPABASE_REMOTE_REQUEST_TARGET_REJECTED');
  }
  return decoded;
}

function responseWithoutBodyStatus(status: number): boolean {
  return status === 101 || status === 103 || status === 204 || status === 205 || status === 304;
}

async function bufferResponse(
  response: Response,
  maximumBytes: number,
  expectedUrl: string,
): Promise<BufferedResponse> {
  if (
    response.redirected ||
    response.type === 'opaqueredirect' ||
    response.status === 0 ||
    (response.status >= 300 && response.status < 400)
  ) {
    throw admissionError('SUPABASE_REMOTE_REQUEST_TARGET_REJECTED');
  }
  if (
    response.url.length > 0 &&
    (parseStrictAbsoluteUrl(response.url) === null || response.url !== expectedUrl)
  ) {
    throw admissionError('SUPABASE_REMOTE_REQUEST_TARGET_REJECTED');
  }
  const bytes = await readBodyBytes(response, maximumBytes);
  const body =
    bytes.byteLength === 0 || responseWithoutBodyStatus(response.status)
      ? null
      : (bytes.slice().buffer as ArrayBuffer);
  return Object.freeze({
    response: new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers),
    }),
    bytes,
  });
}

function parseBufferedJson(bytes: Uint8Array): Record<string, unknown> | null {
  if (bytes.byteLength === 0 || bytes.byteLength > SUPABASE_CONTROL_RESPONSE_MAX_BYTES) return null;
  const decoded = decodeUtf8(bytes);
  if (decoded === null) return null;
  try {
    const parsed = JSON.parse(decoded) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function userIdFromResponse(value: Record<string, unknown>): string | null {
  if (typeof value.id === 'string') return value.id;
  return isRecord(value.user) && typeof value.user.id === 'string' ? value.user.id : null;
}

function sessionBindingFromResponse(
  value: Record<string, unknown>,
  expected: Pick<SupabaseRemoteSessionBinding, 'subject' | 'sessionId'>,
): SupabaseRemoteSessionBinding | null {
  if (typeof value.access_token !== 'string') return null;
  const binding = parseSupabaseRemoteSessionBinding(value.access_token, expected.subject);
  if (binding === null || !sameSessionIdentity(binding, expected)) return null;
  const userId = userIdFromResponse(value);
  return userId === expected.subject ? binding : null;
}

function selfConsistentFreshSession(value: Record<string, unknown>): boolean {
  const userId = userIdFromResponse(value);
  if (userId === null || !AUTH_UUID_PATTERN.test(userId)) return false;
  const binding = sessionBindingFromResponse(value, {
    subject: userId,
    sessionId:
      typeof value.access_token === 'string'
        ? (parseSupabaseRemoteSessionBinding(value.access_token, userId)?.sessionId ?? '')
        : '',
  });
  return binding !== null && isBoundedRequiredString(value.refresh_token, REFRESH_TOKEN_MAX_CHARS);
}

/**
 * Process-local, default-closed authority for the single Supabase transport.
 * It supplements (and never replaces) server JWT verification, RLS, and the
 * durable account-deletion barrier.
 */
export class SupabaseRemoteRequestAdmissionController {
  private readonly supabaseOrigin: URL;
  private readonly publicAuthorizationToken: string | null;
  private state: InternalState = { kind: 'closed', generation: 0 };
  private permitEpoch = 0;
  private permitTail: Promise<void> = Promise.resolve();
  private currentPermit: PermitScope | null = null;
  private readonly inFlight = new Set<TrackedLease>();
  private drainPromise: Promise<void> | null = null;

  constructor(
    configuredSupabaseUrl: string | URL,
    options: SupabaseRemoteRequestAdmissionOptions = {},
  ) {
    const origin = configuredOrigin(configuredSupabaseUrl);
    if (origin === null) throw admissionError('SUPABASE_REMOTE_REQUEST_TARGET_REJECTED');
    const publicAuthorizationToken = options.publicAuthorizationToken;
    if (
      publicAuthorizationToken !== undefined &&
      !isBoundedRequiredString(publicAuthorizationToken, JWT_MAX_CHARS)
    ) {
      throw admissionError('SUPABASE_REMOTE_REQUEST_BINDING_REJECTED');
    }
    this.supabaseOrigin = origin;
    this.publicAuthorizationToken = publicAuthorizationToken ?? null;
  }

  snapshot(): SupabaseRemoteRequestSnapshot {
    const state = this.state;
    return Object.freeze({
      state: state.kind,
      generation: state.generation,
      subject: state.kind === 'closed' ? null : state.binding.subject,
      sessionId: state.kind === 'closed' ? null : state.binding.sessionId,
      inFlight: this.inFlight.size,
      quarantined: [...this.inFlight].filter((lease) => lease.quarantined).length,
    });
  }

  /** Exact check for callers that must not read the published token back. */
  hasActiveBinding(accessToken: unknown, expectedSubject: unknown): boolean {
    const binding = parseSupabaseRemoteSessionBinding(accessToken, expectedSubject);
    const state = this.state;
    return (
      binding !== null &&
      state.kind === 'active' &&
      exactBinding(state.binding, binding) &&
      this.drainPromise === null &&
      ![...this.inFlight].some((lease) => lease.quarantined)
    );
  }

  private ensureNotDraining(): void {
    if (this.drainPromise !== null) {
      throw admissionError('SUPABASE_REMOTE_REQUEST_ADMISSION_CLOSED');
    }
    if ([...this.inFlight].some((lease) => lease.quarantined)) {
      throw admissionError('SUPABASE_REMOTE_REQUEST_DRAIN_QUARANTINED');
    }
  }

  private ensureQuiescent(): void {
    this.ensureNotDraining();
    if (this.currentPermit !== null || this.inFlight.size > 0) {
      throw admissionError('SUPABASE_REMOTE_REQUEST_ADMISSION_CLOSED');
    }
  }

  private invalidatePermits(): void {
    this.permitEpoch += 1;
    this.currentPermit = null;
  }

  private createLease(
    generation: number,
    timeoutMs: number,
    parent: TrackedLease | null = null,
    onTimeout: () => void = () => {},
  ): TrackedLease {
    const controller = new AbortController();
    let resolveSettlement!: () => void;
    let resolveDrainSettlement!: () => void;
    const settlement = new Promise<void>((resolve) => {
      resolveSettlement = resolve;
    });
    const drainSettlement = new Promise<void>((resolve) => {
      resolveDrainSettlement = resolve;
    });
    let settled = false;
    let drainSettled = false;
    const settleDrain = () => {
      if (drainSettled) return;
      drainSettled = true;
      resolveDrainSettlement();
    };
    const lease: TrackedLease = {
      controller,
      generation,
      settlement,
      drainSettlement,
      children: new Set(),
      parent,
      quarantined: false,
      timer: null,
      settle: () => {
        if (settled) return;
        settled = true;
        if (lease.timer !== null) clearTimeout(lease.timer);
        lease.timer = null;
        lease.parent?.children.delete(lease);
        this.inFlight.delete(lease);
        settleDrain();
        resolveSettlement();
      },
      quarantine: () => {
        if (settled || lease.quarantined) return;
        lease.quarantined = true;
        controller.abort();
        onTimeout();
        for (const child of lease.children) child.quarantine();
        settleDrain();
      },
    };
    parent?.children.add(lease);
    this.inFlight.add(lease);
    lease.timer = setTimeout(lease.quarantine, timeoutMs);
    return lease;
  }

  private abortAndDrainTracked(): Promise<void> {
    const tracked = [...this.inFlight];
    for (const lease of tracked) lease.controller.abort();
    if (tracked.length === 0) return Promise.resolve();
    const drain = Promise.allSettled(tracked.map(({ drainSettlement }) => drainSettlement)).then(
      () => {
        if (tracked.some((lease) => this.inFlight.has(lease))) {
          throw admissionError('SUPABASE_REMOTE_REQUEST_DRAIN_QUARANTINED');
        }
      },
    );
    this.drainPromise = drain;
    void drain.then(
      () => {
        if (this.drainPromise === drain) this.drainPromise = null;
      },
      () => {
        if (this.drainPromise === drain) this.drainPromise = null;
      },
    );
    return drain;
  }

  /**
   * Wait for timed-out work to truly finish. Unlike a drain deadline, this
   * never reports success while an SDK/helper continuation can still mutate
   * local session state. Callers may then repeat cleanup and close().
   */
  async waitForResidualSettlement(): Promise<void> {
    while (this.inFlight.size > 0) {
      const residual = [...this.inFlight];
      await Promise.allSettled(residual.map(({ settlement }) => settlement));
    }
  }

  setCandidate(accessToken: unknown, expectedSubject: unknown): SupabaseRemoteSessionBinding {
    this.ensureQuiescent();
    const binding = parseSupabaseRemoteSessionBinding(accessToken, expectedSubject);
    if (binding === null) throw admissionError('SUPABASE_REMOTE_REQUEST_BINDING_REJECTED');
    const state = this.state;
    if (state.kind === 'candidate' && exactBinding(state.binding, binding)) return state.binding;
    if (state.kind !== 'closed') {
      throw admissionError(
        state.kind === 'candidate'
          ? 'SUPABASE_REMOTE_REQUEST_BINDING_REJECTED'
          : 'SUPABASE_REMOTE_REQUEST_ADMISSION_CLOSED',
      );
    }
    this.invalidatePermits();
    this.state = { kind: 'candidate', generation: state.generation + 1, binding };
    return binding;
  }

  activate(accessToken: unknown, expectedSubject: unknown): SupabaseRemoteSessionBinding {
    this.ensureQuiescent();
    const binding = parseSupabaseRemoteSessionBinding(accessToken, expectedSubject);
    const state = this.state;
    if (binding === null || state.kind !== 'candidate' || !exactBinding(state.binding, binding)) {
      throw admissionError('SUPABASE_REMOTE_REQUEST_BINDING_REJECTED');
    }
    this.invalidatePermits();
    this.state = { kind: 'active', generation: state.generation + 1, binding };
    return binding;
  }

  /** Rotate only from the caller's exact published active binding. */
  async rotateActiveBinding(
    previousBinding: SupabaseRemoteSessionBinding,
    accessToken: unknown,
    expectedSubject: unknown,
  ): Promise<SupabaseRemoteSessionBinding> {
    this.ensureNotDraining();
    const previous = validateBinding(previousBinding);
    const binding = parseSupabaseRemoteSessionBinding(accessToken, expectedSubject);
    const state = this.state;
    if (
      binding === null ||
      state.kind !== 'active' ||
      !exactBinding(state.binding, previous) ||
      !sameSessionIdentity(previous, binding)
    ) {
      throw admissionError('SUPABASE_REMOTE_REQUEST_BINDING_REJECTED');
    }
    this.invalidatePermits();
    this.state = { kind: 'active', generation: state.generation + 1, binding };
    await this.abortAndDrainTracked();
    return binding;
  }

  async beginDeletion(
    accessToken: unknown,
    expectedSubject: unknown,
  ): Promise<SupabaseRemoteSessionBinding> {
    this.ensureNotDraining();
    const binding = parseSupabaseRemoteSessionBinding(accessToken, expectedSubject);
    const state = this.state;
    if (binding === null || state.kind !== 'active' || !exactBinding(state.binding, binding)) {
      throw admissionError('SUPABASE_REMOTE_REQUEST_BINDING_REJECTED');
    }
    this.invalidatePermits();
    this.state = { kind: 'deletion', generation: state.generation + 1, binding };
    await this.abortAndDrainTracked();
    return binding;
  }

  close(): Promise<void> {
    this.invalidatePermits();
    const current = this.state;
    this.state = { kind: 'closed', generation: current.generation + 1 };
    if (this.drainPromise !== null) {
      for (const lease of this.inFlight) lease.controller.abort();
      return this.drainPromise;
    }
    return this.abortAndDrainTracked();
  }

  private validatePermitState(permit: SupabaseRemoteRequestPermit): void {
    this.ensureNotDraining();
    const state = this.state;
    if (permit.purpose === 'auth_fresh_sign_in') {
      if (state.kind !== 'closed') {
        throw admissionError('SUPABASE_REMOTE_REQUEST_PERMIT_REJECTED');
      }
      return;
    }
    if (permit.purpose === 'account_deletion') {
      const binding = permit.binding ?? null;
      if (authenticatedDeletionAction(permit.action)) {
        if (binding === null) throw admissionError('SUPABASE_REMOTE_REQUEST_PERMIT_REJECTED');
        if (permit.action === 'preflight') {
          if (
            state.kind !== 'closed' &&
            (state.kind !== 'candidate' || !exactBinding(state.binding, binding))
          ) {
            throw admissionError('SUPABASE_REMOTE_REQUEST_PERMIT_REJECTED');
          }
          return;
        }
        if (permit.action === 'begin') {
          if (state.kind !== 'deletion' || !exactBinding(state.binding, binding)) {
            throw admissionError('SUPABASE_REMOTE_REQUEST_PERMIT_REJECTED');
          }
          return;
        }
        const requiredState = permit.action === 'publication_renew' ? 'active' : 'candidate';
        if (state.kind !== requiredState || !exactBinding(state.binding, binding)) {
          throw admissionError('SUPABASE_REMOTE_REQUEST_PERMIT_REJECTED');
        }
        return;
      }
      if (binding !== null) throw admissionError('SUPABASE_REMOTE_REQUEST_PERMIT_REJECTED');
      return;
    }
    const binding = permit.binding;
    if (permit.purpose === 'auth_logout' && state.kind === 'closed') return;
    if (
      state.kind === 'closed' ||
      state.kind === 'deletion' ||
      !exactBinding(state.binding, binding)
    ) {
      throw admissionError('SUPABASE_REMOTE_REQUEST_PERMIT_REJECTED');
    }
    if (
      (permit.purpose === 'auth_refresh' || permit.purpose === 'auth_verify') &&
      state.kind !== 'candidate'
    ) {
      throw admissionError('SUPABASE_REMOTE_REQUEST_PERMIT_REJECTED');
    }
    if (permit.purpose === 'auth_identity_upgrade' && this.inFlight.size !== 1) {
      throw admissionError('SUPABASE_REMOTE_REQUEST_ADMISSION_CLOSED');
    }
  }

  runWithPermit<T>(
    permitInput: SupabaseRemoteRequestPermit,
    operation: (signal: AbortSignal) => T | Promise<T>,
  ): Promise<T> {
    if (this.currentPermit !== null) {
      return Promise.reject(admissionError('SUPABASE_REMOTE_REQUEST_PERMIT_REJECTED'));
    }
    let permit: SupabaseRemoteRequestPermit;
    try {
      this.ensureNotDraining();
      permit = snapshotPermit(permitInput);
    } catch (error) {
      return Promise.reject(error);
    }
    const generation = this.state.generation;
    const epoch = this.permitEpoch;
    let scopeReference: PermitScope | null = null;
    const lease = this.createLease(generation, validatedPermitTimeoutMs(permit), null, () => {
      if (scopeReference !== null) scopeReference.expired = true;
    });
    const previousTail = this.permitTail;
    const completion = (async () => {
      try {
        await previousTail;
        if (
          lease.controller.signal.aborted ||
          this.state.generation !== generation ||
          this.permitEpoch !== epoch
        ) {
          throw admissionError('SUPABASE_REMOTE_REQUEST_RESULT_STALE');
        }
        this.validatePermitState(permit);
        const scope: PermitScope = {
          epoch,
          generation,
          permit,
          lease,
          requestCount: 0,
          nextBinding: null,
          expired: false,
        };
        scopeReference = scope;
        this.currentPermit = scope;
        try {
          const result = await operation(lease.controller.signal);
          // A helper can accidentally launch the gated fetch without awaiting
          // it. Keep the semantic lease open until every child transport has
          // either truly settled or hit the same quarantine deadline. A
          // quarantined child remains in `inFlight`, so no authority can reopen.
          while (scope.lease.children.size > 0) {
            const children = [...scope.lease.children];
            await Promise.allSettled(children.map(({ drainSettlement }) => drainSettlement));
            if (children.some((child) => this.inFlight.has(child))) {
              throw admissionError('SUPABASE_REMOTE_REQUEST_DRAIN_QUARANTINED');
            }
          }
          if (
            lease.controller.signal.aborted ||
            this.state.generation !== generation ||
            this.permitEpoch !== epoch ||
            this.currentPermit !== scope ||
            scope.expired
          ) {
            throw admissionError('SUPABASE_REMOTE_REQUEST_RESULT_STALE');
          }
          if (scope.requestCount === 0) {
            throw admissionError('SUPABASE_REMOTE_REQUEST_PERMIT_REJECTED');
          }
          if (scope.nextBinding !== null) {
            const state = this.state;
            if (
              (permit.purpose !== 'auth_refresh' && permit.purpose !== 'auth_identity_upgrade') ||
              state.kind === 'closed' ||
              state.kind === 'deletion' ||
              !exactBinding(state.binding, permit.binding)
            ) {
              throw admissionError('SUPABASE_REMOTE_REQUEST_RESULT_STALE');
            }
            this.state = {
              kind: state.kind,
              generation: state.generation + 1,
              binding: scope.nextBinding,
            };
            this.permitEpoch += 1;
          }
          return result;
        } catch (error) {
          if (
            lease.controller.signal.aborted ||
            this.state.generation !== generation ||
            this.permitEpoch !== epoch
          ) {
            throw admissionError('SUPABASE_REMOTE_REQUEST_RESULT_STALE');
          }
          throw error;
        } finally {
          if (this.currentPermit === scope) this.currentPermit = null;
        }
      } finally {
        lease.settle();
      }
    })();
    this.permitTail = completion.then(
      () => undefined,
      () => undefined,
    );
    return completion;
  }

  private assertInvocationCurrent(request: CanonicalRequestSnapshot): void {
    if (
      this.state.generation !== request.generation ||
      this.permitEpoch !== request.permitEpoch ||
      (request.permitScope !== null &&
        (this.currentPermit !== request.permitScope || request.permitScope.expired))
    ) {
      throw admissionError('SUPABASE_REMOTE_REQUEST_RESULT_STALE');
    }
  }

  private permitMatchesRequest(
    scope: PermitScope,
    request: CanonicalRequestSnapshot,
    body: string | null,
    authPurpose: AuthRequestPurpose,
  ): boolean {
    if (
      scope.epoch !== request.permitEpoch ||
      scope.generation !== request.generation ||
      this.currentPermit !== scope ||
      scope.expired
    ) {
      return false;
    }
    const { permit } = scope;
    if (permit.purpose === 'account_deletion') {
      if (
        scope.requestCount >= 1 ||
        request.target !== 'account_deletion' ||
        request.method !== 'POST' ||
        request.strictUrl.rawQuery !== '' ||
        parseDeletionAction(body) !== permit.action
      ) {
        return false;
      }
      const bearer = readBearer(request.headers);
      return authenticatedDeletionAction(permit.action)
        ? bearer === permit.binding?.accessToken
        : bearer === null;
    }
    if (request.target !== 'auth' || authPurpose !== permit.purpose) return false;
    const maximumRequests = permit.purpose === 'auth_refresh' ? 4 : 1;
    if (scope.requestCount >= maximumRequests || scope.nextBinding !== null) return false;
    const bearer = readBearer(request.headers);
    if (permit.purpose === 'auth_refresh') {
      const parsedBody = body === null ? null : parseJsonRecord(body);
      return (
        bearer === this.publicAuthorizationToken &&
        parsedBody?.refresh_token === permit.refreshToken
      );
    }
    if (permit.purpose === 'auth_fresh_sign_in') {
      return bearer === this.publicAuthorizationToken;
    }
    if (permit.purpose === 'auth_identity_upgrade') {
      return request.strictUrl.path === '/auth/v1/verify'
        ? bearer === this.publicAuthorizationToken
        : bearer === permit.binding.accessToken;
    }
    return bearer === permit.binding.accessToken;
  }

  private authorize(request: CanonicalRequestSnapshot, body: string | null): Authorization {
    const target = request.target;
    if (target === 'external' || target === 'unknown' || target === 'realtime') {
      throw admissionError('SUPABASE_REMOTE_REQUEST_TARGET_REJECTED');
    }
    const authPurpose =
      target === 'auth'
        ? classifyAuthRequest(request.strictUrl, request.method, body)
        : ('other' as const);
    if (target === 'auth' && authPurpose === 'other') {
      throw admissionError('SUPABASE_REMOTE_REQUEST_TARGET_REJECTED');
    }
    const scope = request.permitScope;
    if (scope !== null && this.permitMatchesRequest(scope, request, body, authPurpose)) {
      scope.requestCount += 1;
      return { generation: request.generation, scope, authPurpose };
    }
    if (target === 'account_deletion' || (target === 'auth' && authPurpose !== 'auth_verify')) {
      throw admissionError('SUPABASE_REMOTE_REQUEST_PERMIT_REJECTED');
    }
    const state = this.state;
    if (state.kind !== 'active') {
      throw admissionError('SUPABASE_REMOTE_REQUEST_ADMISSION_CLOSED');
    }
    if (readBearer(request.headers) !== state.binding.accessToken) {
      throw admissionError('SUPABASE_REMOTE_REQUEST_BINDING_REJECTED');
    }
    return { generation: request.generation, scope: null, authPurpose };
  }

  private validateControlResponse(
    request: CanonicalRequestSnapshot,
    authorization: Authorization,
    buffered: BufferedResponse,
  ): void {
    if (!buffered.response.ok || request.target !== 'auth') return;
    const parsed = parseBufferedJson(buffered.bytes);
    const scope = authorization.scope;
    if (authorization.authPurpose === 'auth_refresh') {
      if (parsed === null || scope?.permit.purpose !== 'auth_refresh') {
        throw admissionError('SUPABASE_REMOTE_REQUEST_BINDING_REJECTED');
      }
      const nextBinding = sessionBindingFromResponse(parsed, scope.permit.binding);
      if (
        nextBinding === null ||
        !isBoundedRequiredString(parsed.refresh_token, REFRESH_TOKEN_MAX_CHARS)
      ) {
        throw admissionError('SUPABASE_REMOTE_REQUEST_BINDING_REJECTED');
      }
      scope.nextBinding = nextBinding;
      return;
    }
    if (authorization.authPurpose === 'auth_verify') {
      if (parsed === null) throw admissionError('SUPABASE_REMOTE_REQUEST_BINDING_REJECTED');
      const state = this.state;
      const expected =
        scope?.permit.purpose === 'auth_verify'
          ? scope.permit.binding.subject
          : state.kind === 'active'
            ? state.binding.subject
            : null;
      if (expected === null || userIdFromResponse(parsed) !== expected) {
        throw admissionError('SUPABASE_REMOTE_REQUEST_BINDING_REJECTED');
      }
      return;
    }
    if (authorization.authPurpose === 'auth_fresh_sign_in') {
      if (parsed === null) throw admissionError('SUPABASE_REMOTE_REQUEST_BINDING_REJECTED');
      if (request.strictUrl.path === '/auth/v1/otp') {
        if (
          !hasOnlyKeys(parsed, ['message_id']) ||
          (parsed.message_id !== undefined && !isBoundedRequiredString(parsed.message_id))
        ) {
          throw admissionError('SUPABASE_REMOTE_REQUEST_BINDING_REJECTED');
        }
        return;
      }
      if (!selfConsistentFreshSession(parsed)) {
        throw admissionError('SUPABASE_REMOTE_REQUEST_BINDING_REJECTED');
      }
      return;
    }
    if (authorization.authPurpose === 'auth_identity_upgrade') {
      if (parsed === null || scope?.permit.purpose !== 'auth_identity_upgrade') {
        throw admissionError('SUPABASE_REMOTE_REQUEST_BINDING_REJECTED');
      }
      if (typeof parsed.access_token === 'string') {
        const nextBinding = sessionBindingFromResponse(parsed, scope.permit.binding);
        if (nextBinding === null) {
          throw admissionError('SUPABASE_REMOTE_REQUEST_BINDING_REJECTED');
        }
        scope.nextBinding = nextBinding;
        return;
      }
      if (request.strictUrl.path === '/auth/v1/user') {
        if (userIdFromResponse(parsed) !== scope.permit.binding.subject) {
          throw admissionError('SUPABASE_REMOTE_REQUEST_BINDING_REJECTED');
        }
        return;
      }
      if (
        request.strictUrl.path !== '/auth/v1/verify' ||
        !hasOnlyKeys(parsed, ['msg', 'code'], ['msg', 'code']) ||
        !isBoundedRequiredString(parsed.msg) ||
        !isBoundedRequiredString(parsed.code)
      ) {
        throw admissionError('SUPABASE_REMOTE_REQUEST_BINDING_REJECTED');
      }
    }
  }

  private executeRequest<T>(
    request: CanonicalRequestSnapshot,
    operation: (canonicalRequest: Request) => Promise<T>,
    bufferFetchResponse: boolean,
  ): Promise<T> {
    const lease = this.createLease(
      request.generation,
      DEFAULT_REQUEST_TIMEOUT_MS,
      request.permitScope?.lease ?? null,
    );
    return (async () => {
      const combined = combineAbortSignals(lease.controller.signal, request.callerSignal);
      try {
        this.assertInvocationCurrent(request);
        const body =
          request.target === 'auth' || request.target === 'account_deletion'
            ? await readBoundedRequestBody(request.request)
            : null;
        this.assertInvocationCurrent(request);
        const authorization = this.authorize(request, body);
        const canonicalDispatch = new Request(request.request, {
          signal: combined.signal,
          redirect: 'manual',
        });
        const rawResult = await operation(canonicalDispatch);
        if (bufferFetchResponse) {
          if (!(rawResult instanceof Response)) {
            throw admissionError('SUPABASE_REMOTE_REQUEST_TARGET_REJECTED');
          }
          const responseLimit =
            request.target === 'auth' || request.target === 'account_deletion'
              ? SUPABASE_CONTROL_RESPONSE_MAX_BYTES
              : SUPABASE_REMOTE_RESPONSE_MAX_BYTES;
          const buffered = await bufferResponse(
            rawResult,
            responseLimit,
            request.strictUrl.url.href,
          );
          this.assertInvocationCurrent(request);
          this.validateControlResponse(request, authorization, buffered);
          this.assertInvocationCurrent(request);
          return buffered.response as T;
        }
        this.assertInvocationCurrent(request);
        return rawResult;
      } catch (error) {
        if (
          lease.controller.signal.aborted ||
          this.state.generation !== request.generation ||
          this.permitEpoch !== request.permitEpoch
        ) {
          throw admissionError('SUPABASE_REMOTE_REQUEST_RESULT_STALE');
        }
        throw error;
      } finally {
        combined.cleanup();
        lease.settle();
      }
    })();
  }

  runRequest<T>(
    descriptor: SupabaseRemoteRequestDescriptor,
    operation: (canonicalRequest: Request) => Promise<T>,
  ): Promise<T> {
    let request: CanonicalRequestSnapshot;
    try {
      this.ensureNotDraining();
      request = captureCanonicalRequest(
        descriptor,
        this.supabaseOrigin,
        this.state.generation,
        this.permitEpoch,
        this.currentPermit,
      );
    } catch (error) {
      return Promise.reject(error);
    }
    return this.executeRequest(request, operation, false);
  }

  createFetch(
    transport: SupabaseRemoteRequestTransport = (input, init) => fetch(input, init),
  ): SupabaseRemoteRequestTransport {
    return (input, init) => {
      let request: CanonicalRequestSnapshot;
      try {
        this.ensureNotDraining();
        request = captureCanonicalRequest(
          { input, init },
          this.supabaseOrigin,
          this.state.generation,
          this.permitEpoch,
          this.currentPermit,
        );
      } catch (error) {
        return Promise.reject(error);
      }
      return this.executeRequest(request, (canonicalRequest) => transport(canonicalRequest), true);
    };
  }

  /** Realtime is deliberately unavailable until it has an owned lifecycle adapter. */
  runRealtime<T>(
    _input: string | URL,
    _binding: SupabaseRemoteSessionBinding,
    _connect: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    return Promise.reject(admissionError('SUPABASE_REMOTE_REQUEST_TARGET_REJECTED'));
  }
}

export function isSupabaseRemoteRequestAdmissionError(
  error: unknown,
  code?: SupabaseRemoteRequestAdmissionErrorCode,
): error is SupabaseRemoteRequestAdmissionError {
  return (
    error instanceof SupabaseRemoteRequestAdmissionError &&
    (code === undefined || error.code === code)
  );
}
