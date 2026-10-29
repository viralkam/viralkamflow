import { NextRequest, NextResponse } from 'next/server';
import {
  getFacebookOAuthRedirectUri,
  getInstagramOAuthRedirectUri,
  getThreadsOAuthRedirectUri,
  getCleanFacebookCredentials,
  getCleanInstagramCredentials,
  getCleanThreadsCredentials,
  getFacebookScopes,
  getInstagramScopes,
  getThreadsScopes,
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
  const userId = searchParams.get('userId') || request.cookies.get('pf_session_user_id')?.value || 'admin';
  const stateData = JSON.stringify({ accountId: accountId || null, userId });
  const stateQuery = `&state=${encodeURIComponent(Buffer.from(stateData).toString('base64'))}`;

  // 1. FACEBOOK OAUTH
  if (platformKey === 'facebook' || platformKey === 'meta') {
    const { clientId, clientSecret } = getCleanFacebookCredentials();

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        new URL('/connect?error=oauth_not_configured&platform=facebook', request.url)
      );
    }

    const redirectUri = getFacebookOAuthRedirectUri(request);
    const scopes = getFacebookScopes();
    const authUrl = `https://www.facebook.com/v22.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=${encodeURIComponent(scopes)}&response_type=code${stateQuery}`;

    return NextResponse.redirect(authUrl);
  }

  // 2. INSTAGRAM OAUTH
  if (platformKey === 'instagram') {
    const redirectUri = getInstagramOAuthRedirectUri(request);
    const mode = searchParams.get('mode');

    const igCreds = getCleanInstagramCredentials();
    const fbCreds = getCleanFacebookCredentials();
    const isUsingFacebookApp = !igCreds.clientId || igCreds.clientId === fbCreds.clientId;

    // Use Meta Dialog whenever requested OR when using Facebook App credentials (since instagram.com rejects FB App IDs)
    if (mode === 'meta_dialog' || isUsingFacebookApp || mode !== 'direct') {
      const { clientId, clientSecret } = fbCreds.clientId ? fbCreds : igCreds;
      if (!clientId || !clientSecret) {
        return NextResponse.redirect(
          new URL('/connect?error=oauth_not_configured&platform=instagram', request.url)
        );
      }
      const scopeLevel = searchParams.get('scopeLevel') || searchParams.get('scope');
      const basicScopes = 'public_profile,instagram_basic,pages_show_list,pages_read_engagement';
      const fullScopes = 'public_profile,instagram_basic,instagram_content_publish,pages_show_list,business_management,instagram_manage_comments,instagram_manage_messages,pages_messaging';
      const scopes = scopeLevel === 'basic' ? basicScopes : fullScopes;

      const authUrl = `https://www.facebook.com/v22.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&scope=${encodeURIComponent(scopes)}&response_type=code${stateQuery}`;
      return NextResponse.redirect(authUrl);
    }

    // Direct standalone Instagram OAuth (Only for dedicated Instagram App IDs)
    const { clientId, clientSecret } = igCreds;
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        new URL('/connect?error=oauth_not_configured&platform=instagram', request.url)
      );
    }

    const scopes = getInstagramScopes();
    const authUrl = `https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=${encodeURIComponent(scopes)}&response_type=code${stateQuery}`;

    return NextResponse.redirect(authUrl);
  }

  // 3. THREADS OAUTH
  if (platformKey === 'threads') {
    const { clientId, clientSecret } = getCleanThreadsCredentials();

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        new URL('/connect?error=oauth_not_configured&platform=threads', request.url)
      );
    }

    const redirectUri = getThreadsOAuthRedirectUri(request);
    const scopes = getThreadsScopes();

    const authUrl = `https://threads.net/oauth/authorize?client_id=${clientId}&app_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=${encodeURIComponent(scopes)}&response_type=code${stateQuery}`;

    return NextResponse.redirect(authUrl);
  }

  return NextResponse.redirect(new URL('/connect?error=unsupported_platform', request.url));
}
