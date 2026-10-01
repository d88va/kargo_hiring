import { NextRequest, NextResponse } from 'next/server';
import { authToken } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/login') || pathname.startsWith('/api/login')) return NextResponse.next();
  if (!process.env.DASHBOARD_PASSWORD) return new NextResponse('DASHBOARD_PASSWORD not set', { status: 500 });
  if (req.cookies.get('auth')?.value === (await authToken())) return NextResponse.next();
  if (pathname.startsWith('/api/')) return new NextResponse('Unauthorized', { status: 401 });
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
