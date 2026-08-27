import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { getJwtSecretKey } from './jwtSecret';

export type UserRole = 'MANAGER' | 'TEAM_LEAD' | 'EMPLOYEE';

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
  const secretKey = getJwtSecretKey();
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expTime)
    .sign(secretKey);
}

export async function getSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('persevex_session')?.value;
  if (!token) return null;

  try {
    const secretKey = getJwtSecretKey();
    const { payload } = await jwtVerify(token, secretKey);
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