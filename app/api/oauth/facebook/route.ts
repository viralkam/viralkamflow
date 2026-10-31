import { NextRequest, NextResponse } from 'next/server';
import { getFacebookAuthUrl } from '@/lib/oauth/facebookService';

export const dynamic = 'force-dynamic';

/**
 * Facebook OAuth Initiation Route: /api/oauth/facebook
 * 
 * Initiates the official Facebook OAuth dialog.
 * Exclusively uses Meta App credentials (META_CLIENT_ID / META_CLIENT_SECRET).
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const accountId = searchParams.get('accountId');
  const userId =
    searchParams.get('userId') || request.cookies.get('pf_session_user_id')?.value || 'admin';

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
