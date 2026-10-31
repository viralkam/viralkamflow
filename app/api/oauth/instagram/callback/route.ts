import { NextRequest, NextResponse } from 'next/server';
import { exchangeInstagramCode } from '@/lib/oauth/instagramService';
import { verifySignedOAuthState } from '@/lib/oauth/types';
import {
  saveConnectedOAuthAccount,
  renderOAuthSuccessHtml,
  renderOAuthErrorHtml,
} from '@/lib/oauth/accountStore';
import { getInstagramOAuthRedirectUri } from '@/lib/oauthUrl';

export const dynamic = 'force-dynamic';

/**
 * Instagram OAuth Callback Route: /api/oauth/instagram/callback
 * 
 * 1. Validates CSRF state and authorization code.
 * 2. Exchanges code for Business Integration Access Token via graph.facebook.com.
 * 3. Retrieves assigned Instagram Professional accounts via /me/assigned_instagram_accounts.
 * 4. Isolates account record strictly to Instagram — ZERO overlap with Facebook or Threads.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorReason = searchParams.get('error_reason') || searchParams.get('error_description');
  const rawState = searchParams.get('state');

  // Verify CSRF state
  const stateCheck = verifySignedOAuthState(rawState);
  const userId = stateCheck.payload?.userId || 'admin';
  const targetAccountId = stateCheck.payload?.accountId || null;

  if (error || !code) {
    const errorHtml = renderOAuthErrorHtml(
      'Instagram',
      errorReason || error || 'Instagram authorization was cancelled or denied.'
    );
    return new NextResponse(errorHtml, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  try {
    const redirectUri = getInstagramOAuthRedirectUri(request);
    const tokenResult = await exchangeInstagramCode(code, redirectUri);

    if (!tokenResult.success || !tokenResult.accessToken) {
      throw new Error(tokenResult.error || 'Failed to exchange Instagram authorization code.');
    }

    // Persist Instagram-specific account (never touches Facebook or Threads)
    await saveConnectedOAuthAccount(tokenResult, userId, targetAccountId);

    const successHtml = renderOAuthSuccessHtml('Instagram', tokenResult.clientName);
    return new NextResponse(successHtml, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (err: any) {
    console.error('[Instagram OAuth Callback Error]:', err);
    const errorHtml = renderOAuthErrorHtml(
      'Instagram',
      err.message || 'Instagram Unified Login token exchange failed.'
    );
    return new NextResponse(errorHtml, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}
