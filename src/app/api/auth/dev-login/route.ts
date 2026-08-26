import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signSessionToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production' || process.env.DEV_AUTH_ENABLED !== 'true') {
    return NextResponse.json({ success: false, message: 'Dev login not enabled' }, { status: 403 });
  }

  try {
    const { identifier, role } = await req.json();
    if (!identifier) return NextResponse.json({ success: false, message: 'identifier required' }, { status: 400 });

    const clean = identifier.trim();
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: clean }, { employeeId: clean }, { employeeId: clean.toUpperCase() }] },
    });
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });

    const token = await signSessionToken({
      id: user.id,
      employeeId: user.employeeId,
      email: user.email,
      fullName: user.fullName,
      role: user.role as any,
      teamId: user.teamId,
    }, true);

    const resp = NextResponse.json({ success: true, user: { id: user.id, fullName: user.fullName, role: user.role } });
    resp.cookies.set('persevex_session', token, { httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: 30 * 24 * 60 * 60 });
    return resp;
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message || 'Dev login error' }, { status: 500 });
  }
}