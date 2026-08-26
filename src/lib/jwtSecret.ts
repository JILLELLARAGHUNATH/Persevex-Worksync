const DEV_FALLBACK_SECRET = 'persevex-super-secret-enterprise-key-2026-auth-jwt-token';

export function getJwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET?.trim();

  if (process.env.NODE_ENV === 'production') {
    if (!secret) {
      throw new Error('JWT_SECRET is not configured. Authentication cannot start in production.');
    }
    return new TextEncoder().encode(secret);
  }

  return new TextEncoder().encode(secret || DEV_FALLBACK_SECRET);
}
