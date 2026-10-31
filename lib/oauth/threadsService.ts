import {
  getCleanThreadsCredentials,
  getThreadsOAuthRedirectUri,
  getThreadsScopes,
} from '@/lib/oauthUrl';
import { generateSignedOAuthState, OAuthTokenResult } from './types';

/**
 * Threads OAuth Service
 * 
 * Official Meta Architecture:
 * - Direct Threads OAuth Dialog (https://threads.net/oauth/authorize).
 * - Isolated from Facebook and Instagram flows.
 * - Uses THREADS_APP_ID and THREADS_APP_SECRET.
 * - Dedicated callback: /api/oauth/threads/callback
 * - Short-lived to 60-day long-lived token exchange (graph.threads.net).
 * - Threads Profile discovery (username, profile details).
 */

export function getThreadsAuthUrl(
  origin?: string,
  userId = 'admin',
  accountId?: string | null
): { url: string | null; error?: string } {
  const { clientId, clientSecret } = getCleanThreadsCredentials();

  if (!clientId || !clientSecret) {
    return {
      url: null,
      error: 'Threads credentials not configured. Please set THREADS_APP_ID and THREADS_APP_SECRET.',
    };
  }

  const redirectUri = getThreadsOAuthRedirectUri();
  const scopes = getThreadsScopes();
  const state = generateSignedOAuthState('threads', userId, accountId);

  const authUrl = `https://threads.net/oauth/authorize?client_id=${encodeURIComponent(
    clientId
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(
    scopes
  )}&response_type=code&state=${encodeURIComponent(state)}`;

  return { url: authUrl };
}

export async function exchangeThreadsCode(
  code: string,
  redirectUri: string
): Promise<OAuthTokenResult> {
  const { clientId, clientSecret } = getCleanThreadsCredentials();

  if (!clientId || !clientSecret) {
    return {
      success: false,
      platform: 'Threads',
      accountId: '',
      clientName: '',
      accessToken: '',
      error: 'Threads client credentials (THREADS_APP_ID / THREADS_APP_SECRET) missing on server.',
    };
  }

  // 1. Exchange temporary authorization code for short-lived access token
  const tokenRes = await fetch('https://graph.threads.net/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    }),
  });
  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.access_token) {
    const errorMsg =
      tokenData.error_message ||
      tokenData.error?.message ||
      'Failed to exchange Threads authorization code';
    return {
      success: false,
      platform: 'Threads',
      accountId: '',
      clientName: '',
      accessToken: '',
      error: errorMsg,
      rawDetails: tokenData,
    };
  }

  let userAccessToken = tokenData.access_token;
  let accountId = String(tokenData.user_id || `threads-${Date.now()}`);
  let expiresAt: string | undefined = undefined;

  // 2. Exchange for 60-day long-lived access token
  try {
    const longLivedRes = await fetch(
      `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${encodeURIComponent(
        clientSecret
      )}&access_token=${encodeURIComponent(userAccessToken)}`
    );
    const longLivedData = await longLivedRes.json();
    if (longLivedRes.ok && longLivedData.access_token) {
      userAccessToken = longLivedData.access_token;
      expiresAt = new Date(Date.now() + (longLivedData.expires_in || 5184000) * 1000).toISOString();
    }
  } catch (e) {
    console.warn('[Threads OAuth] Long-lived exchange warning:', e);
  }

  // 3. Fetch authenticated Threads profile details
  let clientName = 'Threads User';
  try {
    const meRes = await fetch(
      `https://graph.threads.net/v1.0/me?fields=id,username,name,threads_profile_picture_url&access_token=${encodeURIComponent(
        userAccessToken
      )}`
    );
    const meData = await meRes.json();
    if (meData.username) {
      clientName = meData.username;
      accountId = meData.id || accountId;
    }
  } catch {
    clientName = 'Threads Account';
  }

  return {
    success: true,
    platform: 'Threads',
    accountId,
    clientName,
    accessToken: userAccessToken,
    expiresAt,
  };
}

export async function refreshThreadsToken(existingToken: string): Promise<{
  accessToken: string;
  expiresAt?: string;
  success: boolean;
  error?: string;
}> {
  const { clientSecret } = getCleanThreadsCredentials();
  if (!clientSecret) {
    return { accessToken: existingToken, success: false, error: 'Missing Threads client secret' };
  }

  try {
    const res = await fetch(
      `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${encodeURIComponent(
        clientSecret
      )}&access_token=${encodeURIComponent(existingToken)}`
    );
    const data = await res.json();
    if (res.ok && data.access_token) {
      return {
        accessToken: data.access_token,
        expiresAt: new Date(Date.now() + (data.expires_in || 5184000) * 1000).toISOString(),
        success: true,
      };
    }
    return { accessToken: existingToken, success: false, error: data.error?.message };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { accessToken: existingToken, success: false, error: msg };
  }
}
