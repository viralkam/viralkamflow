import { NextRequest, NextResponse } from 'next/server';
import { exchangeFacebookCode } from '@/lib/oauth/facebookService';
import { verifySignedOAuthState } from '@/lib/oauth/types';
import {
  saveConnectedOAuthAccount,
  renderOAuthSuccessHtml,
  renderOAuthErrorHtml,
} from '@/lib/oauth/accountStore';
import { getFacebookOAuthRedirectUri } from '@/lib/oauthUrl';

export const dynamic = 'force-dynamic';

/**
 * Facebook OAuth Callback Route: /api/oauth/facebook/callback
 * 
 * 1. Validates CSRF state and authorization code.
 * 2. Exchanges code for user token and 60-day long-lived token.
 * 3. Retrieves Facebook Pages and selects target Page token.
 * 4. Isolates account record to Facebook.
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
      'Facebook',
      errorReason || error || 'Authorization was cancelled or denied.'
    );
    return new NextResponse(errorHtml, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  try {
    const redirectUri = getFacebookOAuthRedirectUri(request);
    const tokenResult = await exchangeFacebookCode(code, redirectUri);

    if (!tokenResult.success || !tokenResult.accessToken) {
      throw new Error(tokenResult.error || 'Failed to exchange Facebook authorization code.');
    }

    // Persist Facebook-specific account
    await saveConnectedOAuthAccount(tokenResult, userId, targetAccountId);

    const successHtml = renderOAuthSuccessHtml('Facebook', tokenResult.clientName);
    return new NextResponse(successHtml, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (err: any) {
    console.error('[Facebook OAuth Callback Error]:', err);
    const errorHtml = renderOAuthErrorHtml(
      'Facebook',
      err.message || 'Facebook token exchange failed.'
    );
    return new NextResponse(errorHtml, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}
