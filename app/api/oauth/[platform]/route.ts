import { NextRequest, NextResponse } from 'next/server';
import {
  getFacebookOAuthRedirectUri,
  getInstagramOAuthRedirectUri,
  getYouTubeOAuthRedirectUri,
  getOAuthRedirectUri,
  getCleanMetaCredentials,
  getCleanGoogleCredentials,
  buildFacebookOAuthUrl,
} from '@/lib/oauthUrl';

/**
 * Server-Side OAuth Initiation Handler
 * 
 * Never exposes secrets to the browser.
 * Validates credentials server-side and redirects to provider OAuth login.
 * If credentials are not configured, redirects back with an error code.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ platform: string }> }
) {
  const { platform } = await context.params;
  const platformKey = platform.toLowerCase();

  const searchParams = request.nextUrl.searchParams;
  const accountId = searchParams.get('accountId');
  const userId = searchParams.get('userId') || request.cookies.get('pf_session_user_id')?.value;
  const stateData = JSON.stringify({ accountId: accountId || null, userId: userId || null });
  const stateQuery = `&state=${encodeURIComponent(Buffer.from(stateData).toString('base64'))}`;

  if (platformKey === 'facebook' || platformKey === 'meta') {
    const { clientId, clientSecret } = getCleanMetaCredentials();

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        new URL('/connect?error=oauth_not_configured&platform=facebook', request.url)
      );
    }

    const redirectUri = getFacebookOAuthRedirectUri(request);
    // Facebook Page connection, publishing, comments, and messaging scopes
    const scopes = 'public_profile,pages_show_list,pages_read_engagement,pages_manage_posts,pages_messaging,pages_read_user_content';
    const authUrl = `https://www.facebook.com/v22.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=${encodeURIComponent(scopes)}&response_type=code${stateQuery}`;

    return NextResponse.redirect(authUrl);
  }

  if (platformKey === 'instagram') {
    const { clientId, clientSecret } = getCleanMetaCredentials();

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        new URL('/connect?error=oauth_not_configured&platform=instagram', request.url)
      );
    }

    const redirectUri = getInstagramOAuthRedirectUri(request);
    const mode = searchParams.get('mode'); // 'instagram_login' (default) or 'meta_dialog'

    if (mode === 'meta_dialog') {
      // Instagram Graph API via Meta Facebook Dialog
      const scopes = 'public_profile,instagram_basic,instagram_content_publish,pages_show_list,business_management,instagram_manage_comments,instagram_manage_messages,pages_messaging,pages_read_user_content';
      const authUrl = `https://www.facebook.com/v22.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&scope=${encodeURIComponent(scopes)}&response_type=code${stateQuery}`;
      return NextResponse.redirect(authUrl);
    }

    // Direct Instagram OAuth (Instagram Login for Professionals / Business)
    const scopes = 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish';
    const authUrl = `https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=${encodeURIComponent(scopes)}&response_type=code${stateQuery}`;

    return NextResponse.redirect(authUrl);
  }

  if (platformKey === 'threads') {
    const { clientId, clientSecret } = getCleanMetaCredentials();

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        new URL('/connect?error=oauth_not_configured&platform=threads', request.url)
      );
    }

    const redirectUri = getOAuthRedirectUri('threads', request);
    const scopes = 'threads_basic,threads_content_publish';

    const authUrl = `https://threads.net/oauth/authorize?client_id=${clientId}&app_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=${encodeURIComponent(scopes)}&response_type=code${stateQuery}`;

    return NextResponse.redirect(authUrl);
  }

  if (platformKey === 'youtube') {
    const { clientId, clientSecret } = getCleanGoogleCredentials();

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        new URL('/connect?error=oauth_not_configured&platform=youtube', request.url)
      );
    }

    const redirectUri = getYouTubeOAuthRedirectUri(request);
    const scope = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly';

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;

    return NextResponse.redirect(authUrl);
  }

  return NextResponse.redirect(new URL('/connect', request.url));
}
