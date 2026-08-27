import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { getJwtSecretKey } from './lib/jwtSecret';


const ROLE_ROUTES: Record<string, string> = {
  MANAGER: '/manager',
  TEAM_LEAD: '/team-lead',
  EMPLOYEE: '/employee',
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('persevex_session')?.value;

  const isDashboardRoute =
    pathname.startsWith('/manager') ||
    pathname.startsWith('/team-lead') ||
    pathname.startsWith('/employee') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/change-password');

  if (pathname.startsWith('/admin') || pathname.startsWith('/hr')) {
    return NextResponse.redirect(new URL('/manager', request.url));
  }

  if (!token && isDashboardRoute) {
    const url = new URL('/login', request.url);
    url.searchParams.set('error', 'Session expired. Please log in.');
    return NextResponse.redirect(url);
  }

  if (token) {
    try {
      const { payload } = await jwtVerify(token, getJwtSecretKey());
      const userRole = (payload.role as string)?.toUpperCase();


      if (pathname === '/login') {
        const destination = ROLE_ROUTES[userRole] || '/employee';
        return NextResponse.redirect(new URL(destination, request.url));
      }

      if (pathname.startsWith('/manager') && userRole !== 'MANAGER') {
        return NextResponse.redirect(new URL(ROLE_ROUTES[userRole] || '/employee', request.url));
      }
      if (pathname.startsWith('/team-lead') && userRole !== 'TEAM_LEAD' && userRole !== 'MANAGER') {
        return NextResponse.redirect(new URL(ROLE_ROUTES[userRole] || '/employee', request.url));
      }
    } catch (err) {
      console.error('Middleware JWT Verify Error:', err);
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('persevex_session');
      return response;
    }
  }

  return NextResponse.next();
}

export default middleware;

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};