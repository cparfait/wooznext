import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Admin routes: allow ADMIN and AGENT (agents see only their service)
    if (pathname.startsWith('/admin') && token?.role !== 'ADMIN' && token?.role !== 'AGENT') {
      return NextResponse.redirect(new URL('/agent', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ['/agent((?!/login).)*', '/admin/:path*', '/admin'],
};
