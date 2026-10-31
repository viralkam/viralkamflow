import { NextRequest, NextResponse } from 'next/server';
import { getFacebookAuthUrl } from '@/lib/oauth/facebookService';
import { getInstagramAuthUrl } from '@/lib/oauth/instagramService';
import { getThreadsAuthUrl } from '@/lib/oauth/threadsService';

export const dynamic = 'force-dynamic';

/**
 * Dynamic Platform OAuth Dispatcher Route
 * 
 * Delegates to:
 * - Facebook OAuth Service
 * - Instagram Unified Login OAuth Service
 * - Threads OAuth Service
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ platform: string }> }
) {
  const { platform } = await context.params;
  const platformKey = platform.toLowerCase();

  const searchParams = request.nextUrl.searchParams;
  const accountId = searchParams.get('accountId');
  const userId =
    searchParams.get('userId') || request.cookies.get('pf_session_user_id')?.value || 'admin';

  // 1. FACEBOOK OAUTH
  if (platformKey === 'facebook' || platformKey === 'meta') {
    const { url, error } = getFacebookAuthUrl(request.nextUrl.origin, userId, accountId);
    if (!url || error) {
      return NextResponse.redirect(
        new URL(
          `/connect?error=oauth_not_configured&platform=facebook&message=${encodeURIComponent(
            error || 'Facebook App credentials not configured'
          )}`,
          request.url
        )
      );
    }
    return NextResponse.redirect(url);
  }

  // 2. INSTAGRAM OAUTH (Unified Login)
  if (platformKey === 'instagram') {
    const { url, error } = getInstagramAuthUrl(request.nextUrl.origin, userId, accountId);
    if (!url || error) {
      return NextResponse.redirect(
        new URL(
          `/connect?error=instagram_not_configured&platform=instagram&message=${encodeURIComponent(
            error || 'Instagram Unified Login credentials not configured'
          )}`,
          request.url
        )
      );
    }
    return NextResponse.redirect(url);
  }

  // 3. THREADS OAUTH
  if (platformKey === 'threads') {
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

  return NextResponse.redirect(new URL('/connect?error=unsupported_platform', request.url));
}
