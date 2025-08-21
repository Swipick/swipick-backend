import { NextResponse } from 'next/server';

// Dev-only shim for Firebase Hosting init.json endpoint used by Firebase SDK on redirect flows.
// This avoids noisy 404s in local dev environments.
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}

export const dynamic = 'force-static';
