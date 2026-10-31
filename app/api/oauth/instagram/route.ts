import { NextRequest, NextResponse } from 'next/server';
import { getInstagramAuthUrl } from '@/lib/oauth/instagramService';

export const dynamic = 'force-dynamic';

/**
 * Instagram OAuth Initiation Route: /api/oauth/instagram
 * 
 * Initiates the official Instagram API with Unified Login flow.
 * Uses Meta App ID (META_CLIENT_ID), Meta App Secret (META_CLIENT_SECRET),
 * and the Unified Login Configuration ID (INSTAGRAM_CONFIG_ID).
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const accountId = searchParams.get('accountId');
  const userId =
    searchParams.get('userId') || request.cookies.get('pf_session_user_id')?.value || 'admin';

  const { url, error, configIdMissing } = getInstagramAuthUrl(
    request.nextUrl.origin,
    userId,
    accountId
  );

  if (!url || error) {
    return NextResponse.redirect(
      new URL(
        `/connect?error=instagram_not_configured&platform=instagram&message=${encodeURIComponent(
          error || 'Instagram Unified Login credentials missing'
        )}`,
        request.url
      )
    );
  }

  return NextResponse.redirect(url);
}
