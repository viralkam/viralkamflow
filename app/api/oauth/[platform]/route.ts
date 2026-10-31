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
  getMetaConfigId,
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

  // 1. FACEBOOK OAUTH (100% Facebook Pages Login - ZERO Instagram)
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

  // 2. INSTAGRAM OAUTH (Unified Login or Direct Instagram Login)
  if (platformKey === 'instagram') {
    const redirectUri = getInstagramOAuthRedirectUri(request);
    const { clientId, clientSecret } = getCleanInstagramCredentials();

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        new URL('/connect?error=oauth_not_configured&platform=instagram', request.url)
      );
    }

    const mode = searchParams.get('mode');

    let authUrl: string;
    // Only use Facebook Business dialog if explicitly requested with mode=business
    if (mode === 'business') {
      const configId = searchParams.get('config_id') || getMetaConfigId();
      authUrl = `https://www.facebook.com/dialog/oauth?client_id=${clientId}&config_id=${configId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&response_type=code${stateQuery}`;
    } else {
      // DEFAULT: Direct Instagram ID & Password page (instagram.com)
      const scopeParam = searchParams.get('scope');
      const scopes = scopeParam || getInstagramScopes();
      authUrl = `https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=${clientId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&scope=${encodeURIComponent(scopes)}&response_type=code${stateQuery}`;
    }

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
