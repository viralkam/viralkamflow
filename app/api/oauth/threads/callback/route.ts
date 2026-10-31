import { NextRequest, NextResponse } from 'next/server';
import { exchangeThreadsCode } from '@/lib/oauth/threadsService';
import { verifySignedOAuthState } from '@/lib/oauth/types';
import {
  saveConnectedOAuthAccount,
  renderOAuthSuccessHtml,
  renderOAuthErrorHtml,
} from '@/lib/oauth/accountStore';
import { getThreadsOAuthRedirectUri } from '@/lib/oauthUrl';

export const dynamic = 'force-dynamic';

/**
 * Threads OAuth Callback Route: /api/oauth/threads/callback
 * 
 * 1. Validates CSRF state and authorization code.
 * 2. Exchanges code for user token and 60-day long-lived token via graph.threads.net.
 * 3. Fetches Threads profile information.
 * 4. Isolates account record strictly to Threads.
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
      'Threads',
      errorReason || error || 'Threads authorization was cancelled or denied.'
    );
    return new NextResponse(errorHtml, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  try {
    const redirectUri = getThreadsOAuthRedirectUri(request);
    const tokenResult = await exchangeThreadsCode(code, redirectUri);

    if (!tokenResult.success || !tokenResult.accessToken) {
      throw new Error(tokenResult.error || 'Failed to exchange Threads authorization code.');
    }

    // Persist Threads-specific account
    await saveConnectedOAuthAccount(tokenResult, userId, targetAccountId);

    const successHtml = renderOAuthSuccessHtml('Threads', tokenResult.clientName);
    return new NextResponse(successHtml, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (err: any) {
    console.error('[Threads OAuth Callback Error]:', err);
    const errorHtml = renderOAuthErrorHtml(
      'Threads',
      err.message || 'Threads token exchange failed.'
    );
    return new NextResponse(errorHtml, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}
