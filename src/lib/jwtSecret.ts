const DEV_FALLBACK_SECRET = 'persevex-super-secret-enterprise-key-2026-auth-jwt-token';

export function getJwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET?.trim() || DEV_FALLBACK_SECRET;
  return new TextEncoder().encode(secret);
}

