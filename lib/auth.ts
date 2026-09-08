import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const DEV_FALLBACK_SECRET = 'dev-only-insecure-secret-do-not-use-in-production';

let cachedSecret: Uint8Array | undefined;

/**
 * Resolved lazily (not at import time) so a missing secret surfaces as a failed
 * auth request rather than crashing the build. In production a real JWT_SECRET is
 * mandatory; outside production a fixed dev key keeps local sessions stable.
 */
function getSecret(): Uint8Array {
  if (!cachedSecret) {
    const raw = process.env.JWT_SECRET;
    if (!raw && process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production — refusing to sign with a default key');
    }
    cachedSecret = new TextEncoder().encode(raw || DEV_FALLBACK_SECRET);
  }
  return cachedSecret;
}

export interface JWTPayload {
  id: number;
  name: string;
  initials: string;
  avatar_color: string;
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<JWTPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function signAdminToken(): Promise<string> {
  return new SignJWT({ admin: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('8h')
    .sign(getSecret());
}

export async function verifyAdminToken(): Promise<boolean> {
  const cookieStore = cookies();
  const token = cookieStore.get('admin_token')?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.admin === true;
  } catch {
    return false;
  }
}
