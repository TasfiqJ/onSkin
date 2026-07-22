import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
} from 'node:fs';
import path from 'node:path';

const DEFAULT_MAX_DIAGNOSTIC_STRING_BYTES = 128 * 1024;
const DEFAULT_MAX_DIAGNOSTIC_DEPTH = 20;
const DEFAULT_MAX_DIAGNOSTIC_NODES = 250_000;
const DEFAULT_MAX_TEXT_ARTIFACT_BYTES = 8 * 1024 * 1024;

const NETWORK_URL_PATTERN = /\b(?:https?|wss?):\/\/[^\s<>"')\]}]+/giu;
const DISALLOWED_CONTROL_PATTERN = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/u;
const PRIVATE_KEY_PATTERN = /-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----/iu;
const SUPABASE_PAT_PATTERN = /(?<![A-Za-z0-9_])sbp_(?:oauth_)?[a-f0-9]{40}(?![A-Za-z0-9_])/giu;
const SUPABASE_OPAQUE_KEY_PATTERN =
  /(?<![A-Za-z0-9_])sb_(?:secret|publishable)_[A-Za-z0-9_-]{22}_[A-Za-z0-9_-]{8}(?![A-Za-z0-9_])/giu;
const PACKAGE_AND_SOURCE_TOKEN_PATTERN =
  /(?<![A-Za-z0-9_])(?:npm_[A-Za-z0-9]{24,64}|gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{40,255})(?![A-Za-z0-9_])/gu;
const JWT_PATTERN =
  /(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?![A-Za-z0-9_-])/gu;
const HTTP_AUTH_PATTERN =
  /\b(?:authorization\s*[:=]\s*)?(?:basic|bearer|digest)\s+(?!<redacted(?:-[a-z0-9]+)*>)[^\s"',;}{]{4,}/giu;
const CREDENTIAL_ASSIGNMENT_PATTERN =
  /\b(?:[a-z0-9_-]*token|(?:x[_-]?)?[a-z0-9_-]*api[_-]?key|apikey|authorization|[a-z0-9_-]*secret|passcode|[a-z0-9_-]*password)\b["']?\s*[:=]\s*["']?(?!<redacted(?:-[a-z0-9]+)*>|null\b|false\b|true\b)[^"'\s,}\]]{4,}/giu;
// Require meaningful encoded data, not Markdown table separators made only of
// hyphens. Sixteen alphanumeric characters is deliberately far below the
// entropy carried by any credential-sized payload while excluding punctuation
// runs used by the generated manifest renderer.
const LONG_BASE64_PATTERN =
  /(?<![a-z0-9+/_-])(?=(?:[+/_-]*[a-z0-9]){16})[a-z0-9+/_-]{160,}={0,2}(?![a-z0-9+/_=-])/giu;
const DATABASE_URI_PATTERN =
  /\b(?:amqps?|mariadb|mongodb(?:\+srv)?|mysql|postgres(?:ql)?|rediss?):\/\/[^\s<>"')\]}]+/giu;
const INFRASTRUCTURE_ASSIGNMENT_PATTERN =
  /\b(?:[a-z0-9_-]*(?:anon[_-]?key|database[_-]?url|db[_-]?url|direct[_-]?url|pgpassword|postgres[_-]?url|publishable[_-]?key|service[_-]?role[_-]?key))\b["']?\s*[:=]\s*["']?(?!<redacted(?:-[a-z0-9]+)*>|null\b|false\b|true\b)[^"'\s,}\]]{1,}/giu;
const SESSION_AND_COOKIE_PATTERN =
  /\b(?:cookie|set-cookie|session(?:_id)?|sessionid)\b["']?\s*[:=]\s*["']?(?!<redacted(?:-[a-z0-9]+)*>|null\b|false\b|true\b)[^\r\n"',}\]]{1,}/giu;
const AWS_ASSIGNMENT_PATTERN =
  /\b(?:aws[_-]?)?(?:access[_-]?key[_-]?id|secret[_-]?(?:access[_-]?)?key|session[_-]?token)\b["']?\s*[:=]\s*["']?(?!<redacted(?:-[a-z0-9]+)*>|null\b|false\b|true\b)[^"'\s,}\]]{4,}/giu;
const AWS_ACCESS_KEY_PATTERN = /(?<![A-Z0-9])(?:AKIA|ASIA)[A-Z0-9]{16}(?![A-Z0-9])/gu;
const STRIPE_KEY_PATTERN =
  /(?<![A-Za-z0-9_])(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}(?![A-Za-z0-9_])/gu;
const SLACK_TOKEN_PATTERN =
  /(?<![A-Za-z0-9_-])xox(?:a|b|p|r|s)-[A-Za-z0-9-]{24,}(?![A-Za-z0-9_-])/gu;

function unique(values) {
  return [...new Set(values)];
}

function patternMatches(pattern, text) {
  pattern.lastIndex = 0;
  const matched = pattern.test(text);
  pattern.lastIndex = 0;
  return matched;
}

function recursivelyDecodedVariants(value, maxRounds = 4) {
  const variants = [String(value ?? '')];
  let current = variants[0];
  for (let round = 0; round < maxRounds; round += 1) {
    let decoded;
    try {
      decoded = decodeURIComponent(current);
    } catch {
      break;
    }
    if (decoded === current) break;
    variants.push(decoded);
    current = decoded;
  }
  return variants;
}

function containsHostPathAcrossEncodings(value) {
  return recursivelyDecodedVariants(value).some((candidate) => {
    let components = candidate;
    try {
      const parsed = new URL(candidate);
      components = `${parsed.pathname}\n${parsed.search}\n${parsed.hash}\n${parsed.username}`;
    } catch {
      // Inspect the malformed literal itself without echoing it.
    }
    return (
      /(?:^|[/?#=&])(?:[A-Za-z]:[\\/]|(?:Applications|Library|System|Users|Volumes|dev|etc|home|mnt|opt|private|proc|root|run|srv|sys|tmp|usr|var|workspace)(?:[\\/]|$)|\.claude[\\/]worktrees(?:[\\/]|$))/imu.test(
        components,
      ) || /[\\/]AppData[\\/]Local[\\/]Temp(?:[\\/]|$)/iu.test(components)
    );
  });
}

function containsSensitiveLiteralAcrossEncodings(value) {
  return recursivelyDecodedVariants(value).some((candidate) =>
    [
      PRIVATE_KEY_PATTERN,
      SUPABASE_PAT_PATTERN,
      SUPABASE_OPAQUE_KEY_PATTERN,
      PACKAGE_AND_SOURCE_TOKEN_PATTERN,
      JWT_PATTERN,
      HTTP_AUTH_PATTERN,
      CREDENTIAL_ASSIGNMENT_PATTERN,
      DATABASE_URI_PATTERN,
      INFRASTRUCTURE_ASSIGNMENT_PATTERN,
      SESSION_AND_COOKIE_PATTERN,
      AWS_ASSIGNMENT_PATTERN,
      AWS_ACCESS_KEY_PATTERN,
      STRIPE_KEY_PATTERN,
      SLACK_TOKEN_PATTERN,
      LONG_BASE64_PATTERN,
    ].some((pattern) => patternMatches(pattern, candidate)),
  );
}

function sensitiveCredentialFieldName(value) {
  const normalized = String(value)
    .replace(/([a-z0-9])([A-Z])/gu, '$1_$2')
    .replace(/[^A-Za-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .toLowerCase();
  return (
    /(?:^|_)(?:access_key_id|api_key|apikey|authorization|cookie|passcode|password|pgpassword|private_key|secret|secret_key|session|session_id|sessionid|token)$/u.test(
      normalized,
    ) ||
    /(?:^|_)(?:anon_key|database_url|db_url|direct_url|postgres_url|publishable_key|service_role_key)$/u.test(
      normalized,
    )
  );
}

function isSafeCredentialFieldValue(value) {
  return (
    value == null ||
    value === false ||
    value === true ||
    (typeof value === 'string' &&
      (/^<redacted(?:-[a-z0-9]+)*>$/iu.test(value) || value.length === 0))
  );
}

function networkUrlLiterals(text) {
  return text.match(NETWORK_URL_PATTERN) ?? [];
}

function textWithoutNetworkUrls(text) {
  return text.replace(NETWORK_URL_PATTERN, '<network-url>');
}

function containsAbsoluteHostPath(text) {
  const candidate = textWithoutNetworkUrls(text);
  const normalizedEscapes = candidate.replaceAll('\\\\', '\\');
  return (
    /(?:^|[\s"'([{=,:])[A-Za-z]:[\\/]/u.test(normalizedEscapes) ||
    /(?:^|[\s"'([{=,:])\\\\[^\\\s]+[\\/][^\\\s]+/u.test(candidate) ||
    /(?:^|[\s"'([{=,:])\/(?:Applications|Library|System|Users|Volumes|dev|etc|home|mnt|opt|private|proc|root|run|srv|sys|tmp|usr|var|workspace)(?:\/|$)/iu.test(
      candidate,
    ) ||
    /[\\/]AppData[\\/]Local[\\/]Temp(?:[\\/]|$)/iu.test(candidate) ||
    /(?:^|[\\/])\.claude[\\/]worktrees(?:[\\/]|$)/iu.test(candidate)
  );
}

export function collectEvidenceDiagnosticPolicyFailures(
  label,
  value,
  { allowLocalhostUrlQuery = false } = {},
) {
  const failures = [];
  const text = String(value ?? '');

  if (containsAbsoluteHostPath(text)) {
    failures.push(`${label} contains a user-profile, temporary, or worktree absolute path`);
  }
  if (DISALLOWED_CONTROL_PATTERN.test(text)) {
    failures.push(`${label} contains a disallowed control character`);
  }
  if (/\b(?:assets-library|blob|content|data|file|filesystem|ph):[^\s<>"')\]}]*/iu.test(text)) {
    failures.push(`${label} contains a sensitive URI literal`);
  }
  if (DATABASE_URI_PATTERN.test(text)) {
    failures.push(`${label} contains a database or service credential URI literal`);
  }
  DATABASE_URI_PATTERN.lastIndex = 0;

  for (const literal of networkUrlLiterals(text)) {
    if (containsHostPathAcrossEncodings(literal)) {
      failures.push(`${label} contains a host-path-bearing network URL literal`);
    }
    if (containsSensitiveLiteralAcrossEncodings(literal)) {
      failures.push(`${label} contains a credential-bearing network URL literal`);
    }
    let parsed;
    try {
      parsed = new URL(literal);
    } catch {
      failures.push(`${label} contains a malformed network URL literal`);
      continue;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'ws:') {
      failures.push(`${label} contains a disallowed ${parsed.protocol} URL literal`);
      continue;
    }
    if (parsed.hostname !== 'localhost') {
      failures.push(`${label} contains a non-localhost network URL literal`);
      continue;
    }
    if (parsed.username || parsed.password) {
      failures.push(`${label} contains credentials in a localhost URL literal`);
    }
    if (parsed.hash) {
      failures.push(`${label} contains an unredacted URL fragment`);
    }
    if (parsed.search && !allowLocalhostUrlQuery && parsed.search !== '?redacted-query') {
      failures.push(`${label} contains an unredacted URL query value`);
    }
  }

  if (HTTP_AUTH_PATTERN.test(text)) {
    failures.push(`${label} contains an HTTP authorization credential literal`);
  }
  HTTP_AUTH_PATTERN.lastIndex = 0;
  if (CREDENTIAL_ASSIGNMENT_PATTERN.test(text)) {
    failures.push(`${label} contains an unredacted credential or token value`);
  }
  CREDENTIAL_ASSIGNMENT_PATTERN.lastIndex = 0;
  if (INFRASTRUCTURE_ASSIGNMENT_PATTERN.test(text)) {
    failures.push(`${label} contains an unredacted infrastructure credential value`);
  }
  INFRASTRUCTURE_ASSIGNMENT_PATTERN.lastIndex = 0;
  if (SESSION_AND_COOKIE_PATTERN.test(text)) {
    failures.push(`${label} contains an unredacted cookie or session value`);
  }
  SESSION_AND_COOKIE_PATTERN.lastIndex = 0;
  if (AWS_ASSIGNMENT_PATTERN.test(text) || AWS_ACCESS_KEY_PATTERN.test(text)) {
    failures.push(`${label} contains an AWS credential literal`);
  }
  AWS_ASSIGNMENT_PATTERN.lastIndex = 0;
  AWS_ACCESS_KEY_PATTERN.lastIndex = 0;
  if (STRIPE_KEY_PATTERN.test(text)) {
    failures.push(`${label} contains a Stripe credential literal`);
  }
  STRIPE_KEY_PATTERN.lastIndex = 0;
  if (SLACK_TOKEN_PATTERN.test(text)) {
    failures.push(`${label} contains a Slack credential literal`);
  }
  SLACK_TOKEN_PATTERN.lastIndex = 0;
  if (SUPABASE_PAT_PATTERN.test(text) || SUPABASE_OPAQUE_KEY_PATTERN.test(text)) {
    failures.push(`${label} contains a Supabase credential literal`);
  }
  SUPABASE_PAT_PATTERN.lastIndex = 0;
  SUPABASE_OPAQUE_KEY_PATTERN.lastIndex = 0;
  if (PACKAGE_AND_SOURCE_TOKEN_PATTERN.test(text)) {
    failures.push(`${label} contains a package or source-control credential literal`);
  }
  PACKAGE_AND_SOURCE_TOKEN_PATTERN.lastIndex = 0;
  if (JWT_PATTERN.test(text)) {
    failures.push(`${label} contains a JWT credential literal`);
  }
  JWT_PATTERN.lastIndex = 0;
  if (PRIVATE_KEY_PATTERN.test(text)) {
    failures.push(`${label} contains a private-key header`);
  }
  if (LONG_BASE64_PATTERN.test(text)) {
    failures.push(`${label} contains a long base64-like payload`);
  }
  LONG_BASE64_PATTERN.lastIndex = 0;
  return unique(failures);
}

export function collectEvidenceDiagnosticValueFailures(
  label,
  value,
  {
    allowLocalhostUrlQuery = false,
    maxDepth = DEFAULT_MAX_DIAGNOSTIC_DEPTH,
    maxNodes = DEFAULT_MAX_DIAGNOSTIC_NODES,
    maxStringBytes = DEFAULT_MAX_DIAGNOSTIC_STRING_BYTES,
  } = {},
) {
  const failures = [];
  const seen = new WeakSet();
  let nodes = 0;
  let nodeLimitRecorded = false;
  const visit = (currentLabel, currentValue, depth) => {
    nodes += 1;
    if (nodes > maxNodes) {
      if (!nodeLimitRecorded) {
        failures.push(`${label} exceeds ${maxNodes} reviewed diagnostic nodes or entries`);
        nodeLimitRecorded = true;
      }
      return;
    }
    if (typeof currentValue === 'string') {
      if (Buffer.byteLength(currentValue, 'utf8') > maxStringBytes) {
        failures.push(`${currentLabel} exceeds ${maxStringBytes} diagnostic string bytes`);
      }
      failures.push(
        ...collectEvidenceDiagnosticPolicyFailures(currentLabel, currentValue, {
          allowLocalhostUrlQuery,
        }),
      );
      return;
    }
    if (!currentValue || typeof currentValue !== 'object') return;
    if (seen.has(currentValue)) return;
    if (depth > maxDepth) {
      failures.push(`${currentLabel} exceeds the reviewed diagnostic nesting depth`);
      return;
    }
    seen.add(currentValue);
    if (Array.isArray(currentValue)) {
      for (let index = 0; index < currentValue.length && !nodeLimitRecorded; index += 1) {
        visit(`${currentLabel}[${index}]`, currentValue[index], depth + 1);
      }
      return;
    }
    let entryIndex = 0;
    for (const [key, item] of Object.entries(currentValue)) {
      if (nodeLimitRecorded) break;
      const entryLabel = `${currentLabel}.<entry:${entryIndex}>`;
      visit(`${entryLabel}.key`, key, depth + 1);
      if (sensitiveCredentialFieldName(key) && !isSafeCredentialFieldValue(item)) {
        failures.push(`${entryLabel}.value contains an unredacted credential field value`);
      }
      visit(`${entryLabel}.value`, item, depth + 1);
      entryIndex += 1;
    }
  };
  visit(label, value, 0);
  return unique(failures);
}

export function collectEvidenceTextArtifactHygieneFailures(
  label,
  bytes,
  { allowLocalhostUrlQuery = false, maxBytes = DEFAULT_MAX_TEXT_ARTIFACT_BYTES } = {},
) {
  if (!Buffer.isBuffer(bytes)) return [`${label} is not available as bytes`];
  const failures = [];
  if (bytes.length > maxBytes) failures.push(`${label} exceeds ${maxBytes} reviewed bytes`);
  const text = bytes.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(bytes)) {
    failures.push(`${label} is not canonical UTF-8 text`);
  }
  failures.push(
    ...collectEvidenceDiagnosticPolicyFailures(label, text, { allowLocalhostUrlQuery }),
  );
  return unique(failures);
}

function canonicalEvidenceJsonValue(value, ancestors = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('evidence JSON contains a non-finite number');
    return value;
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) throw new Error('evidence JSON contains a circular array');
    ancestors.add(value);
    try {
      return value.map((item) => canonicalEvidenceJsonValue(item, ancestors));
    } finally {
      ancestors.delete(value);
    }
  }
  if (value && typeof value === 'object') {
    if (ancestors.has(value)) throw new Error('evidence JSON contains a circular object');
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error('evidence JSON contains a non-plain object');
    }
    ancestors.add(value);
    try {
      const canonical = {};
      for (const key of Object.keys(value).sort()) {
        const item = value[key];
        if (item === undefined || typeof item === 'function' || typeof item === 'symbol') {
          throw new Error(`evidence JSON contains an unsupported value at ${key}`);
        }
        canonical[key] = canonicalEvidenceJsonValue(item, ancestors);
      }
      return canonical;
    } finally {
      ancestors.delete(value);
    }
  }
  throw new Error(`evidence JSON contains unsupported ${typeof value} data`);
}

export function canonicalEvidenceJsonBytes(value) {
  return Buffer.from(`${JSON.stringify(canonicalEvidenceJsonValue(value), null, 2)}\n`, 'utf8');
}

function inspectContainedFilePath(filePath, containmentRoot) {
  const root = path.resolve(containmentRoot);
  const candidate = path.resolve(filePath);
  const relative = path.relative(root, candidate);
  if (
    relative.length === 0 ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error('evidence input must be a strict lexical descendant of its containment root');
  }

  const rootStats = lstatSync(root);
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
    throw new Error('evidence containment root must be a real directory');
  }
  const rootRealPath = realpathSync(root);
  const ancestorStats = [{ path: root, stats: rootStats }];
  const segments = relative.split(path.sep);
  let cursor = root;
  for (let index = 0; index < segments.length; index += 1) {
    cursor = path.join(cursor, segments[index]);
    const stats = lstatSync(cursor);
    if (stats.isSymbolicLink()) {
      throw new Error('evidence input may not cross a symbolic-link or junction boundary');
    }
    if (index < segments.length - 1 && !stats.isDirectory()) {
      throw new Error('evidence input parent must be a real directory');
    }
    ancestorStats.push({ path: cursor, stats });
  }
  const candidateRealPath = realpathSync(candidate);
  const realRelative = path.relative(rootRealPath, candidateRealPath);
  if (
    realRelative.length === 0 ||
    realRelative === '..' ||
    realRelative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(realRelative)
  ) {
    throw new Error('evidence input resolves outside its containment root');
  }
  return { ancestorStats, candidateRealPath, rootRealPath };
}

function sameFileIdentity(left, right) {
  return (
    left.isFile() === right.isFile() &&
    left.isDirectory() === right.isDirectory() &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs &&
    left.ctimeMs === right.ctimeMs &&
    (left.ino === 0 || right.ino === 0 || left.ino === right.ino) &&
    (left.dev === 0 || right.dev === 0 || left.dev === right.dev)
  );
}

export function readBoundedRegularFile(
  filePath,
  { containmentRoot = null, maxBytes = DEFAULT_MAX_TEXT_ARTIFACT_BYTES } = {},
) {
  const containedBefore = containmentRoot
    ? inspectContainedFilePath(filePath, containmentRoot)
    : null;
  const linkStats = lstatSync(filePath);
  if (linkStats.isSymbolicLink() || !linkStats.isFile()) {
    throw new Error('evidence input must be a regular file without a symbolic-link boundary');
  }
  if (!Number.isSafeInteger(linkStats.size) || linkStats.size < 0 || linkStats.size > maxBytes) {
    throw new Error(`evidence input exceeds ${maxBytes} reviewed bytes`);
  }

  const noFollow = constants.O_NOFOLLOW ?? 0;
  const descriptor = openSync(filePath, constants.O_RDONLY | noFollow);
  try {
    const before = fstatSync(descriptor);
    if (
      !before.isFile() ||
      before.size !== linkStats.size ||
      before.size > maxBytes ||
      before.dev !== linkStats.dev ||
      before.ino !== linkStats.ino ||
      before.mtimeMs !== linkStats.mtimeMs ||
      before.ctimeMs !== linkStats.ctimeMs
    ) {
      throw new Error('evidence input changed before its bounded read');
    }
    const readExact = () => {
      const bytes = Buffer.alloc(before.size);
      let offset = 0;
      while (offset < bytes.length) {
        const count = readSync(descriptor, bytes, offset, bytes.length - offset, offset);
        if (count === 0) throw new Error('evidence input ended during its bounded read');
        offset += count;
      }
      return bytes;
    };
    const bytes = readExact();
    const after = fstatSync(descriptor);
    if (
      !after.isFile() ||
      bytes.length !== before.size ||
      after.size !== before.size ||
      after.mtimeMs !== before.mtimeMs ||
      after.ctimeMs !== before.ctimeMs ||
      (before.ino !== 0 && after.ino !== before.ino) ||
      (before.dev !== 0 && after.dev !== before.dev)
    ) {
      throw new Error('evidence input changed during its bounded read');
    }
    const verification = readExact();
    const final = fstatSync(descriptor);
    if (
      !verification.equals(bytes) ||
      !final.isFile() ||
      final.size !== before.size ||
      final.mtimeMs !== before.mtimeMs ||
      final.ctimeMs !== before.ctimeMs ||
      final.ino !== before.ino ||
      final.dev !== before.dev
    ) {
      throw new Error('evidence input changed during its verification read');
    }
    if (containedBefore) {
      const containedAfter = inspectContainedFilePath(filePath, containmentRoot);
      if (
        containedAfter.rootRealPath !== containedBefore.rootRealPath ||
        containedAfter.candidateRealPath !== containedBefore.candidateRealPath ||
        containedAfter.ancestorStats.length !== containedBefore.ancestorStats.length ||
        containedAfter.ancestorStats.some(
          ({ path: afterPath, stats }, index) =>
            afterPath !== containedBefore.ancestorStats[index].path ||
            !sameFileIdentity(containedBefore.ancestorStats[index].stats, stats),
        ) ||
        !sameFileIdentity(final, containedAfter.ancestorStats.at(-1).stats)
      ) {
        throw new Error('evidence input containment changed during its bounded read');
      }
    }
    return bytes;
  } finally {
    closeSync(descriptor);
  }
}

export function inspectCanonicalEvidenceJson(
  label,
  bytes,
  {
    allowLocalhostUrlQuery = false,
    maxBytes = DEFAULT_MAX_TEXT_ARTIFACT_BYTES,
    maxDepth = DEFAULT_MAX_DIAGNOSTIC_DEPTH,
    maxNodes = DEFAULT_MAX_DIAGNOSTIC_NODES,
    maxStringBytes = DEFAULT_MAX_DIAGNOSTIC_STRING_BYTES,
  } = {},
) {
  const failures = [];
  if (!Buffer.isBuffer(bytes)) {
    return { failures: [`${label} is not available as bytes`], value: null };
  }
  if (bytes.length > maxBytes) {
    return { failures: [`${label} exceeds ${maxBytes} reviewed bytes`], value: null };
  }
  const text = bytes.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(bytes)) {
    return { failures: [`${label} is not canonical UTF-8 text`], value: null };
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return {
      failures: [`${label} is not valid JSON`],
      value: null,
    };
  }
  const valueFailures = collectEvidenceDiagnosticValueFailures(label, value, {
    allowLocalhostUrlQuery,
    maxDepth,
    maxNodes,
    maxStringBytes,
  });
  failures.push(...valueFailures);
  const structureIsUnsafeToSerialize = valueFailures.some(
    (failure) =>
      failure.includes('reviewed diagnostic nesting depth') ||
      failure.includes('reviewed diagnostic nodes or entries'),
  );
  if (!structureIsUnsafeToSerialize) {
    try {
      if (!canonicalEvidenceJsonBytes(value).equals(bytes)) {
        failures.push(
          `${label} is not canonical JSON (two-space indentation, deterministic parsed key order, and one trailing newline are required)`,
        );
      }
    } catch {
      failures.push(`${label} cannot be serialized under the canonical JSON contract`);
    }
  }
  return { failures: unique(failures), value };
}

function redactNetworkUrl(literal) {
  if (containsHostPathAcrossEncodings(literal)) {
    return '<redacted-sensitive-url>';
  }
  if (containsSensitiveLiteralAcrossEncodings(literal)) {
    return '<redacted-credential-url>';
  }
  try {
    const parsed = new URL(literal);
    if (parsed.username || parsed.password) {
      return '<redacted-credential-url>';
    }
    if (parsed.hostname !== 'localhost') return '<redacted-network-url>';
    if (parsed.search) parsed.search = '?redacted-query';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return '<redacted-malformed-url>';
  }
}

function utf8Tail(text, maxBytes) {
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) return text;
  const characters = [...text];
  let low = 0;
  let high = characters.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (Buffer.byteLength(characters.slice(middle).join(''), 'utf8') > maxBytes) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return characters.slice(low).join('');
}

export function sanitizeEvidenceDiagnosticForDisplay(
  value,
  { maxBytes = 2_000, maxLines = 20 } = {},
) {
  const rawLimit = Math.max(64 * 1024, maxBytes * 8);
  let text = String(value ?? '');
  if (text.length > rawLimit) text = `<earlier diagnostic omitted>\n${text.slice(-rawLimit)}`;
  const protectedNetworkUrls = [];
  let networkUrlMarker = '\u{e000}CAT07URL';
  while (text.includes(networkUrlMarker)) networkUrlMarker += 'X';
  const networkUrlMarkerEnd = '\u{e001}';
  text = text
    .replace(
      /-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----[\s\S]*?(?:-----END(?: [A-Z0-9]+)? PRIVATE KEY-----|$)/giu,
      '<redacted-private-key>',
    )
    .replace(DATABASE_URI_PATTERN, '<redacted-database-uri>')
    .replace(NETWORK_URL_PATTERN, (literal) => {
      const index = protectedNetworkUrls.push(redactNetworkUrl(literal)) - 1;
      return `${networkUrlMarker}${index}${networkUrlMarkerEnd}`;
    })
    .replace(
      /(?<![A-Za-z0-9])(?:[A-Za-z]:[\\/]|\\\\[^\\\s]+[\\/][^\\\s]+)[^\r\n<>"']*/gu,
      '<redacted-absolute-path>',
    )
    .replace(
      /\/(?:Applications|Library|System|Users|Volumes|dev|etc|home|mnt|opt|private|proc|root|run|srv|sys|tmp|usr|var|workspace)(?:\/[^\s<>"']*)?/giu,
      '<redacted-absolute-path>',
    )
    .replace(/(?:^|[\\/])\.claude[\\/]worktrees(?:[\\/][^\s<>"']*)?/gimu, (match) =>
      match.startsWith('/') || match.startsWith('\\')
        ? '<redacted-worktree-path>'
        : ' <redacted-worktree-path>',
    )
    .replace(HTTP_AUTH_PATTERN, '<redacted-http-credential>')
    .replace(CREDENTIAL_ASSIGNMENT_PATTERN, (match) => {
      const separator = match.search(/[:=]/u);
      return separator < 0 ? '<redacted-credential>' : `${match.slice(0, separator + 1)}<redacted>`;
    })
    .replace(INFRASTRUCTURE_ASSIGNMENT_PATTERN, (match) => {
      const separator = match.search(/[:=]/u);
      return separator < 0 ? '<redacted-credential>' : `${match.slice(0, separator + 1)}<redacted>`;
    })
    .replace(SESSION_AND_COOKIE_PATTERN, (match) => {
      const separator = match.search(/[:=]/u);
      return separator < 0 ? '<redacted-session>' : `${match.slice(0, separator + 1)}<redacted>`;
    })
    .replace(AWS_ASSIGNMENT_PATTERN, (match) => {
      const separator = match.search(/[:=]/u);
      return separator < 0
        ? '<redacted-aws-credential>'
        : `${match.slice(0, separator + 1)}<redacted>`;
    })
    .replace(AWS_ACCESS_KEY_PATTERN, '<redacted-aws-access-key>')
    .replace(STRIPE_KEY_PATTERN, '<redacted-stripe-key>')
    .replace(SLACK_TOKEN_PATTERN, '<redacted-slack-token>')
    .replace(SUPABASE_PAT_PATTERN, '<redacted-supabase-pat>')
    .replace(SUPABASE_OPAQUE_KEY_PATTERN, '<redacted-supabase-key>')
    .replace(PACKAGE_AND_SOURCE_TOKEN_PATTERN, '<redacted-package-or-source-token>')
    .replace(JWT_PATTERN, '<redacted-jwt>')
    .replace(LONG_BASE64_PATTERN, '<redacted-long-payload>');
  const escapedMarker = networkUrlMarker.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  text = text
    .replace(
      new RegExp(`${escapedMarker}(\\d+)${networkUrlMarkerEnd}`, 'gu'),
      (_match, index) => protectedNetworkUrls[Number(index)] ?? '<redacted-network-url>',
    )
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/gu, '');
  const lines = text.trim().split('\n');
  if (lines.length > maxLines) {
    text = `<earlier diagnostic lines omitted>\n${lines.slice(-maxLines).join('\n')}`;
  } else {
    text = lines.join('\n');
  }
  text = utf8Tail(text, maxBytes).trim();
  return text;
}
