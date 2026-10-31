import { NextRequest, NextResponse } from 'next/server';
import { getThreadsAuthUrl } from '@/lib/oauth/threadsService';

export const dynamic = 'force-dynamic';

/**
 * Threads OAuth Initiation Route: /api/oauth/threads
 * 
 * Initiates the official Threads OAuth flow via threads.net/oauth/authorize.
 * Uses dedicated Threads credentials (THREADS_APP_ID / THREADS_APP_SECRET).
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const accountId = searchParams.get('accountId');
  const userId =
    searchParams.get('userId') || request.cookies.get('pf_session_user_id')?.value || 'admin';

  const { url, error } = getThreadsAuthUrl(request.nextUrl.origin, userId, accountId);

  if (!url || error) {
    return NextResponse.redirect(
      new URL(
        `/connect?error=threads_not_configured&platform=threads&message=${encodeURIComponent(
          error || 'Threads credentials not configured'
        )}`,
        request.url
      )
    );
  }

  return NextResponse.redirect(url);
}
