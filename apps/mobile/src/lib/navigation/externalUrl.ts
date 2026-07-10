const CONTROL_CHAR_RE = /[\u0000-\u001F\u007F]/;
const MAX_EXTERNAL_URL_LENGTH = 2048;

/**
 * Normalize a URL before handing it to Linking/WebBrowser. External handoffs are a
 * privacy boundary: never allow custom schemes, embedded credentials, fragments, or
 * malformed strings from server/catalog rows.
 */
export function safeExternalHttpsUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length > MAX_EXTERNAL_URL_LENGTH || CONTROL_CHAR_RE.test(trimmed))
    return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null;
  url.hash = '';
  return url.toString();
}

export function appendExternalQueryParam(
  value: string | null | undefined,
  key: string,
  paramValue: string,
): string | null {
  const safe = safeExternalHttpsUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  url.searchParams.set(key, paramValue);
  return url.toString();
}
