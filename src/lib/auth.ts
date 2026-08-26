import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export type UserRole = 'MANAGER' | 'TEAM_LEAD' | 'EMPLOYEE';

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'persevex-super-secret-enterprise-key-2026-auth-jwt-token'
);

export interface UserSession {
  id: string;
  employeeId: string;
  email: string;
  fullName: string;
  role: UserRole;
  departmentId?: string | null;
  teamId?: string | null;
}

export async function signSessionToken(payload: UserSession, rememberMe: boolean = false): Promise<string> {
  const expTime = rememberMe ? '30d' : '12h';
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expTime)
    .sign(SECRET_KEY);
}

export async function getSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('persevex_session')?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload as unknown as UserSession;
  } catch (error) {
    console.error('Session verification failed:', error);
    return null;
  }
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete('persevex_session');
}