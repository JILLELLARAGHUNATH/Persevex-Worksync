import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, signSessionToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Unauthorized: Only Managers can switch sessions.' }, { status: 403 });
    }

    const { targetUserId } = await req.json();
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });

    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found.' }, { status: 404 });
    }

    const token = await signSessionToken({
      id: targetUser.id,
      employeeId: targetUser.employeeId,
      email: targetUser.email,
      fullName: targetUser.fullName,
      role: targetUser.role as any,
      teamId: targetUser.teamId,
    });

    const response = NextResponse.json({
      success: true,
      targetRole: targetUser.role,
    });

    response.cookies.set('persevex_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 3600,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Impersonation failed.' }, { status: 500 });
  }
}