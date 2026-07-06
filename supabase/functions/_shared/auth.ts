export function bearerToken(req: Request): string | null {
  const match = req.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}

export function bearerAuthorizationHeader(req: Request): string | null {
  const token = bearerToken(req);
  return token ? `Bearer ${token}` : null;
}
