import { NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest) {
  return NextResponse.json({ ok: false, message: 'Auth provider is not configured for this app build.' }, { status: 501 });
}

export async function POST(_request: NextRequest) {
  return NextResponse.json({ ok: false, message: 'Auth provider is not configured for this app build.' }, { status: 501 });
}
