const EVENT_ID = /^[0-9a-f]{32}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SENTRY_API_URL = /^https:\/\/(?:sentry\.io|(?:us|us2|de)\.sentry\.io)$/i;
const PLACEHOLDER = /your[-_]|replace-with|x{4,}|pending|example/i;
const SYMBOL_ERROR = /(?:sourcemap|source_map|symbol|dsym|debug_file|missing_dif)/i;

function normalize(value) {
  return String(value ?? '').trim();
}

function normalizeUuid(value) {
  return normalize(value).toLowerCase();
}

function normalizeDebugId(value) {
  const candidate = normalize(value).toLowerCase();
  if (UUID.test(candidate)) return candidate;
  if (/^[0-9a-f]{32}$/.test(candidate)) {
    return `${candidate.slice(0, 8)}-${candidate.slice(8, 12)}-${candidate.slice(12, 16)}-${candidate.slice(16, 20)}-${candidate.slice(20)}`;
  }
  return '';
}

function walk(value, visit) {
  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, visit));
    return;
  }
  if (!value || typeof value !== 'object') return;
  visit(value);
  Object.values(value).forEach((item) => walk(item, visit));
}

function eventRelease(event) {
  return normalize(
    typeof event?.release === 'object' && event.release !== null
      ? event.release.version
      : event?.release,
  );
}

function eventIdentifier(event) {
  return normalize(event?.eventID ?? event?.eventId ?? event?.event_id ?? event?.id).toLowerCase();
}

function eventTimestamp(event) {
  const candidate = normalize(event?.dateReceived ?? event?.dateCreated ?? event?.date_received);
  const parsed = Date.parse(candidate);
  return Number.isFinite(parsed) ? parsed : null;
}

function symbolErrors(event) {
  const errors = [];
  for (const item of Array.isArray(event?.errors) ? event.errors : []) {
    const kind = normalize(item?.type ?? item?.message);
    if (SYMBOL_ERROR.test(kind)) errors.push(kind);
  }
  return errors;
}

function collectedDebugIds(images) {
  const ids = (Array.isArray(images) ? images : [])
    .map((image) => normalizeDebugId(image?.debugId ?? image?.debug_id ?? image?.uuid))
    .filter(Boolean);
  return [...new Set(ids)].sort();
}

function exceptionFrames(event) {
  const frames = [];
  for (const entry of Array.isArray(event?.entries) ? event.entries : []) {
    for (const exception of Array.isArray(entry?.data?.values) ? entry.data.values : []) {
      if (Array.isArray(exception?.stacktrace?.frames)) {
        frames.push(...exception.stacktrace.frames);
      }
    }
  }
  return frames;
}

function nativeImages(event) {
  for (const candidate of [event?.debugMeta?.images, event?.debug_meta?.images]) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function hexAddress(value) {
  const candidate = normalize(value);
  if (!/^(?:0x[0-9a-f]+|\d+)$/i.test(candidate)) return null;
  try {
    return BigInt(candidate);
  } catch {
    return null;
  }
}

function hasResolvedNativeFrame(event, binaryUuids) {
  const images = nativeImages(event).flatMap((object) => {
    const debugId = normalizeDebugId(object.debugId ?? object.debug_id ?? object.uuid);
    if (!binaryUuids.includes(debugId)) return [];
    const start = hexAddress(object.imageAddr ?? object.image_addr ?? object.imageVmAddr);
    const size = hexAddress(object.imageSize ?? object.image_size);
    return [{ debugId, start, end: start !== null && size !== null ? start + size : null }];
  });
  let resolved = false;
  for (const object of exceptionFrames(event)) {
    const instruction = hexAddress(object.instructionAddr ?? object.instruction_addr);
    const symbolAddress = hexAddress(object.symbolAddr ?? object.symbol_addr);
    const symbol = normalize(object.function ?? object.symbol);
    const belongsToExactImage =
      instruction !== null &&
      symbolAddress !== null &&
      images.some(
        (image) =>
          image.start !== null &&
          image.end !== null &&
          instruction >= image.start &&
          instruction < image.end &&
          symbolAddress >= image.start &&
          symbolAddress <= instruction,
      );
    if (
      belongsToExactImage &&
      symbol &&
      !/^(?:0x[0-9a-f]+|unknown|<unknown>|<redacted>|main)$/i.test(symbol) &&
      !/^.+\s+\+\s+(?:0x)?[0-9a-f]+$/i.test(symbol)
    ) {
      resolved = true;
    }
  }
  return resolved;
}

function hasUploadedMachODebugFile(files, uuid) {
  return (
    Array.isArray(files) &&
    files.some((file) => {
      const debugId = normalizeUuid(file?.debugId ?? file?.uuid);
      const symbolType = normalize(file?.symbolType).toLowerCase();
      const features = Array.isArray(file?.data?.features)
        ? file.data.features.map((feature) => normalize(feature).toLowerCase())
        : [];
      return debugId === uuid && symbolType === 'macho' && features.includes('debug');
    })
  );
}

function hasResolvedJavascriptFrame(event) {
  return exceptionFrames(event).some((object) => {
    const line = object.lineNo ?? object.lineno ?? object.line_no;
    const source = normalize(object.origAbsPath ?? object.orig_abs_path);
    const symbol = normalize(object.function ?? object.symbol);
    if (
      Number.isInteger(line) &&
      line > 0 &&
      /\.[cm]?[jt]sx?(?:$|[?#])/i.test(source) &&
      !/(?:\.bundle|\.hbc|\.min\.js)(?:$|[?#])/i.test(source) &&
      /^[A-Za-z_$][\w$.:<>-]{2,}$/.test(symbol) &&
      !/^<anonymous>$/i.test(symbol)
    ) {
      return true;
    }
    return false;
  });
}

function sourceMapDebugAccepted(value, expectedDebugId) {
  let accepted = false;
  walk(value, (object) => {
    if (
      normalizeDebugId(object.debug_id ?? object.debugId) === expectedDebugId &&
      object.uploaded_source_file_with_correct_debug_id === true &&
      object.uploaded_source_map_with_correct_debug_id === true
    ) {
      accepted = true;
    }
  });
  return accepted;
}

export function validateSentryRecoveryResponses(
  { javascriptEvent, nativeEvent, sourceMapDebug, debugFilesByUuid },
  { javascriptEventId, nativeEventId, release, dist, binaryUuids, hermesDebugId, now, maxAgeMs },
) {
  const errors = [];
  for (const [label, event, expectedId] of [
    ['JavaScript', javascriptEvent, javascriptEventId],
    ['native', nativeEvent, nativeEventId],
  ]) {
    if (eventIdentifier(event) !== normalize(expectedId).toLowerCase()) {
      errors.push(`${label} recovery event ID does not match the requested Sentry event.`);
    }
    if (eventRelease(event) !== release) {
      errors.push(`${label} recovery event release does not match the release candidate.`);
    }
    if (normalize(event?.dist) !== dist) {
      errors.push(`${label} recovery event dist does not match the release candidate.`);
    }
    const capturedAt = eventTimestamp(event);
    if (capturedAt === null) errors.push(`${label} recovery event timestamp is missing.`);
    else {
      if (capturedAt > now) errors.push(`${label} recovery event is future-dated.`);
      if (now - capturedAt > maxAgeMs) errors.push(`${label} recovery event is stale.`);
    }
    if (symbolErrors(event).length > 0) {
      errors.push(`${label} recovery event reports symbol or source-map errors.`);
    }
  }

  if (!hasResolvedJavascriptFrame(javascriptEvent)) {
    errors.push('JavaScript recovery event has no resolved source frame.');
  }
  if (!sourceMapDebugAccepted(sourceMapDebug, normalizeDebugId(hermesDebugId))) {
    errors.push('Sentry source-map recovery does not match the exact Hermes debug ID.');
  }
  if (!hasResolvedNativeFrame(nativeEvent, binaryUuids)) {
    errors.push('Native recovery event has no resolved symbol frame.');
  }
  const nativeEventDebugIds = collectedDebugIds(nativeImages(nativeEvent));
  for (const uuid of binaryUuids) {
    if (!nativeEventDebugIds.includes(uuid)) {
      errors.push('Native recovery event does not contain every exact binary UUID.');
      break;
    }
    const files = debugFilesByUuid?.[uuid];
    if (!hasUploadedMachODebugFile(files, uuid)) {
      errors.push(
        'Sentry does not report an uploaded Mach-O debug file for every exact binary UUID.',
      );
      break;
    }
  }
  return errors;
}

async function responseJson(response, label) {
  if (!response.ok) throw new Error(`${label} lookup failed with HTTP ${response.status}.`);
  try {
    return await response.json();
  } catch {
    throw new Error(`${label} lookup did not return JSON.`);
  }
}

export async function verifySentryRecovery({
  env,
  javascriptEventId,
  nativeEventId,
  release,
  dist,
  binaryUuids,
  hermesDebugId,
  now = Date.now(),
  maxAgeMs = 30 * 24 * 60 * 60 * 1000,
  fetchImpl = fetch,
}) {
  const authToken = normalize(env.SENTRY_AUTH_TOKEN);
  const org = normalize(env.SENTRY_ORG);
  const project = normalize(env.SENTRY_PROJECT);
  const apiUrl = normalize(env.SENTRY_API_URL || 'https://sentry.io').replace(/\/+$/, '');
  if (!authToken || PLACEHOLDER.test(authToken)) throw new Error('Sentry auth token is missing.');
  if (!org || PLACEHOLDER.test(org)) throw new Error('Sentry organization is missing.');
  if (!project || PLACEHOLDER.test(project)) throw new Error('Sentry project is missing.');
  if (!SENTRY_API_URL.test(apiUrl))
    throw new Error('Sentry API URL is not an approved HTTPS host.');
  if (!EVENT_ID.test(javascriptEventId) || !EVENT_ID.test(nativeEventId)) {
    throw new Error('Both Sentry recovery event IDs must be 32 hexadecimal characters.');
  }
  if (javascriptEventId.toLowerCase() === nativeEventId.toLowerCase()) {
    throw new Error('JavaScript and native recovery event IDs must be distinct.');
  }

  const projectRoot = `${apiUrl}/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}`;
  const headers = { Authorization: `Bearer ${authToken}` };
  const get = async (url, label) => {
    let response;
    try {
      response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(15_000) });
    } catch {
      throw new Error(`${label} lookup failed.`);
    }
    return responseJson(response, label);
  };
  const [javascriptEvent, nativeEvent, sourceMapDebug, ...debugFileResponses] = await Promise.all([
    get(`${projectRoot}/events/${javascriptEventId}/`, 'JavaScript event'),
    get(`${projectRoot}/events/${nativeEventId}/`, 'native event'),
    get(`${projectRoot}/events/${javascriptEventId}/source-map-debug/`, 'source-map debug'),
    ...binaryUuids.map((uuid) =>
      get(
        `${projectRoot}/files/dsyms/?debug_id=${encodeURIComponent(uuid)}`,
        'debug-file inventory',
      ),
    ),
  ]);
  const debugFilesByUuid = Object.fromEntries(
    binaryUuids.map((uuid, index) => [uuid, debugFileResponses[index]]),
  );
  const errors = validateSentryRecoveryResponses(
    { javascriptEvent, nativeEvent, sourceMapDebug, debugFilesByUuid },
    {
      javascriptEventId,
      nativeEventId,
      release,
      dist,
      binaryUuids,
      hermesDebugId,
      now,
      maxAgeMs,
    },
  );
  if (errors.length > 0) throw new Error(errors.join(' '));
  return {
    verified: true,
    javascriptEventId: javascriptEventId.toLowerCase(),
    nativeEventId: nativeEventId.toLowerCase(),
    release,
    dist,
  };
}
