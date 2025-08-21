import { NextRequest, NextResponse } from 'next/server';

// Dev-only shim for Firebase redirect handler to avoid 404s on localhost.
// Firebase expects a hosting route at /__/auth/handler during redirect flows.
// In local dev we ensure this path exists and redirects back to /login.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const redirectUrl = url.searchParams.get('redirectUrl') || '/login';
  return NextResponse.redirect(redirectUrl);
}

export const dynamic = 'force-static';
