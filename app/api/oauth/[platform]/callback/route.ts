import { NextRequest, NextResponse } from 'next/server';
import { exchangeFacebookCode } from '@/lib/oauth/facebookService';
import { exchangeInstagramCode } from '@/lib/oauth/instagramService';
import { exchangeThreadsCode } from '@/lib/oauth/threadsService';
import { verifySignedOAuthState } from '@/lib/oauth/types';
import {
  saveConnectedOAuthAccount,
  renderOAuthSuccessHtml,
  renderOAuthErrorHtml,
} from '@/lib/oauth/accountStore';
import {
  getFacebookOAuthRedirectUri,
  getInstagramOAuthRedirectUri,
  getThreadsOAuthRedirectUri,
} from '@/lib/oauthUrl';

export const dynamic = 'force-dynamic';

/**
 * Dynamic Platform OAuth Callback Dispatcher Route
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ platform: string }> }
) {
  const { platform } = await context.params;
  const platformKey = platform.toLowerCase();

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorReason = searchParams.get('error_reason') || searchParams.get('error_description');
  const rawState = searchParams.get('state');

  // Verify CSRF state
  const stateCheck = verifySignedOAuthState(rawState);
  const userId = stateCheck.payload?.userId || 'admin';
  const targetAccountId = stateCheck.payload?.accountId || null;

  const platformDisplayName =
    platformKey === 'instagram' ? 'Instagram' : platformKey === 'threads' ? 'Threads' : 'Facebook';

  if (error || !code) {
    const errorHtml = renderOAuthErrorHtml(
      platformDisplayName,
      errorReason || error || `${platformDisplayName} authorization was cancelled or denied.`
    );
    return new NextResponse(errorHtml, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  try {
    let tokenResult;

    if (platformKey === 'facebook' || platformKey === 'meta') {
      const redirectUri = getFacebookOAuthRedirectUri(request);
      tokenResult = await exchangeFacebookCode(code, redirectUri);
    } else if (platformKey === 'instagram') {
      const redirectUri = getInstagramOAuthRedirectUri(request);
      tokenResult = await exchangeInstagramCode(code, redirectUri);
    } else if (platformKey === 'threads') {
      const redirectUri = getThreadsOAuthRedirectUri(request);
      tokenResult = await exchangeThreadsCode(code, redirectUri);
    } else {
      throw new Error(`Unsupported OAuth platform: ${platform}`);
    }

    if (!tokenResult.success || !tokenResult.accessToken) {
      throw new Error(tokenResult.error || `Failed to complete ${platformDisplayName} exchange.`);
    }

    // Persist isolated account record
    await saveConnectedOAuthAccount(tokenResult, userId, targetAccountId);

    const successHtml = renderOAuthSuccessHtml(platformDisplayName, tokenResult.clientName);
    return new NextResponse(successHtml, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (err: any) {
    console.error(`[${platformDisplayName} OAuth Callback Error]:`, err);
    const errorHtml = renderOAuthErrorHtml(
      platformDisplayName,
      err.message || `${platformDisplayName} exchange failed.`
    );
    return new NextResponse(errorHtml, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}
