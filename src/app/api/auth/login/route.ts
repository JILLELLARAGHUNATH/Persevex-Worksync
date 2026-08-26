import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signSessionToken, UserRole } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { identifier, password, rememberMe } = await req.json();

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Please provide Email/Employee ID and Password.' }, { status: 400 });
    }

    const cleanIdentifier = identifier.trim().toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: cleanIdentifier },
          { employeeId: cleanIdentifier.toUpperCase() },
          { employeeId: identifier.trim() },
        ],
        isDeleted: false,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'No active account found with this ID or Email.' }, { status: 401 });
    }

    if (user.accountStatus !== 'ACTIVE') {
      return NextResponse.json(
        { error: `Your account is currently ${user.accountStatus}. Please contact management.` },
        { status: 403 }
      );
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
    }

    let role = user.role as UserRole;
    if ((role as any) === 'ADMIN' || (role as any) === 'HR') {
      role = 'MANAGER';
    }

    const token = await signSessionToken(
      {
        id: user.id,
        employeeId: user.employeeId,
        email: user.email,
        fullName: user.fullName,
        role,
        teamId: user.teamId,
      },
      rememberMe
    );

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        role,
      },
    });

    response.cookies.set('persevex_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: rememberMe ? 30 * 24 * 60 * 60 : 12 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Authentication error' }, { status: 500 });
  }
}
