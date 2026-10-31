import {
  getCleanFacebookCredentials,
  getFacebookOAuthRedirectUri,
  getFacebookScopes,
} from '@/lib/oauthUrl';
import { generateSignedOAuthState, OAuthTokenResult } from './types';

/**
 * Facebook OAuth Service
 * 
 * Handles:
 * 1. Independent Facebook OAuth Authorization URL generation
 * 2. Authorization code exchange for user access token
 * 3. 60-day long-lived token exchange
 * 4. Facebook Pages discovery and Page Access Token selection
 * 5. Facebook token refresh
 */

export function getFacebookAuthUrl(
  origin?: string,
  userId = 'admin',
  accountId?: string | null
): { url: string | null; error?: string } {
  const { clientId, clientSecret } = getCleanFacebookCredentials();

  if (!clientId || !clientSecret) {
    return {
      url: null,
      error: 'Facebook OAuth credentials not configured. Please set META_CLIENT_ID and META_CLIENT_SECRET.',
    };
  }

  const redirectUri = getFacebookOAuthRedirectUri();
  const scopes = getFacebookScopes();
  const state = generateSignedOAuthState('facebook', userId, accountId);

  const authUrl = `https://www.facebook.com/v22.0/dialog/oauth?client_id=${encodeURIComponent(
    clientId
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(
    scopes
  )}&response_type=code&state=${encodeURIComponent(state)}`;

  return { url: authUrl };
}

export async function exchangeFacebookCode(
  code: string,
  redirectUri: string
): Promise<OAuthTokenResult> {
  const { clientId, clientSecret } = getCleanFacebookCredentials();

  if (!clientId || !clientSecret) {
    return {
      success: false,
      platform: 'Facebook',
      accountId: '',
      clientName: '',
      accessToken: '',
      error: 'Facebook client credentials (META_CLIENT_ID / META_CLIENT_SECRET) missing on server.',
    };
  }

  // 1. Exchange temporary authorization code for user access token
  const tokenRes = await fetch(
    `https://graph.facebook.com/v22.0/oauth/access_token?client_id=${encodeURIComponent(
      clientId
    )}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${encodeURIComponent(
      clientSecret
    )}&code=${encodeURIComponent(code)}`
  );
  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.access_token) {
    const errorMsg = tokenData.error?.message || 'Failed to exchange Facebook authorization code.';
    return {
      success: false,
      platform: 'Facebook',
      accountId: '',
      clientName: '',
      accessToken: '',
      error: errorMsg,
      rawDetails: tokenData,
    };
  }

  let userAccessToken = tokenData.access_token;
  let expiresAt: string | undefined = undefined;

  // 2. Exchange for 60-day long-lived access token
  try {
    const longLivedRes = await fetch(
      `https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(
        clientId
      )}&client_secret=${encodeURIComponent(clientSecret)}&fb_exchange_token=${encodeURIComponent(
        userAccessToken
      )}`
    );
    const longLivedData = await longLivedRes.json();
    if (longLivedRes.ok && longLivedData.access_token) {
      userAccessToken = longLivedData.access_token;
      expiresAt = new Date(Date.now() + (longLivedData.expires_in || 5184000) * 1000).toISOString();
    }
  } catch (e) {
    console.warn('[Facebook OAuth] Long-lived token exchange warning:', e);
  }

  // 3. Query authenticated user's Facebook Pages
  let finalAccountId = '';
  let finalClientName = 'Facebook Page';
  let finalAccessToken = userAccessToken;

  try {
    const pagesRes = await fetch(
      `https://graph.facebook.com/v22.0/me/accounts?fields=id,name,access_token,category,tasks&access_token=${encodeURIComponent(
        userAccessToken
      )}`
    );
    const pagesData = await pagesRes.json();

    if (pagesRes.ok && Array.isArray(pagesData.data) && pagesData.data.length > 0) {
      const targetPage =
        pagesData.data.find(
          (p: { id: string; name?: string; access_token?: string; tasks?: string[] }) =>
            p.tasks?.includes('CREATE_CONTENT') ||
            p.tasks?.includes('MANAGE') ||
            p.tasks?.includes('MODERATE')
        ) || pagesData.data[0];

      finalAccountId = targetPage.id;
      finalClientName = targetPage.name || 'Facebook Page';
      finalAccessToken = targetPage.access_token || userAccessToken;
    } else {
      // User has no pages yet, fetch personal profile
      const meRes = await fetch(
        `https://graph.facebook.com/v22.0/me?fields=id,name&access_token=${encodeURIComponent(
          userAccessToken
        )}`
      );
      const meData = await meRes.json();
      finalAccountId = meData.id || `fb-${Date.now()}`;
      finalClientName = meData.name || 'Facebook User';
    }
  } catch (pageErr) {
    console.warn('[Facebook OAuth] Pages fetch error:', pageErr);
    finalAccountId = `fb-${Date.now()}`;
  }

  return {
    success: true,
    platform: 'Facebook',
    accountId: finalAccountId,
    clientName: finalClientName,
    accessToken: finalAccessToken,
    expiresAt,
  };
}

export async function refreshFacebookToken(existingToken: string): Promise<{
  accessToken: string;
  expiresAt?: string;
  success: boolean;
  error?: string;
}> {
  const { clientId, clientSecret } = getCleanFacebookCredentials();
  if (!clientId || !clientSecret) {
    return { accessToken: existingToken, success: false, error: 'Missing Facebook credentials' };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(
        clientId
      )}&client_secret=${encodeURIComponent(clientSecret)}&fb_exchange_token=${encodeURIComponent(
        existingToken
      )}`
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
