import {
  getCleanInstagramCredentials,
  getInstagramOAuthRedirectUri,
  getInstagramScopes,
} from '@/lib/oauthUrl';
import { generateSignedOAuthState, OAuthTokenResult } from './types';

/**
 * Instagram API with Unified Login OAuth Service
 * 
 * Official Meta Architecture:
 * - Built on Facebook Login for Business with Unified Login.
 * - Uses Meta App ID (META_CLIENT_ID) and Meta App Secret (META_CLIENT_SECRET).
 * - Uses Unified Login Configuration ID (INSTAGRAM_CONFIG_ID) from Meta App Dashboard:
 *   (Use cases -> Manage messaging & content on Instagram -> API setup with Unified login -> Configuration ID).
 * - Prompts client to log in via Instagram or Facebook and select their Instagram Professional account.
 * - Dedicated callback: /api/oauth/instagram/callback
 * - Discovers connected Instagram account via /me/assigned_instagram_accounts.
 */

export function getInstagramAuthUrl(
  origin?: string,
  userId = 'admin',
  accountId?: string | null
): { url: string | null; error?: string; configIdMissing?: boolean } {
  const { clientId, clientSecret, configId } = getCleanInstagramCredentials();

  if (!clientId || !clientSecret) {
    return {
      url: null,
      error: 'Meta App credentials not configured. Please set META_CLIENT_ID and META_CLIENT_SECRET in .env.local.',
    };
  }

  const redirectUri = getInstagramOAuthRedirectUri();
  const state = generateSignedOAuthState('instagram', userId, accountId);

  // If config_id is present, Meta Unified Login uses that configuration directly
  // If not yet entered, we pass required Instagram permissions as fallback so the flow doesn't freeze
  const configParam = configId ? `&config_id=${encodeURIComponent(configId)}` : '';
  const scopeParam = !configId ? `&scope=${encodeURIComponent(getInstagramScopes())}` : '';

  const authUrl = `https://www.facebook.com/v22.0/dialog/oauth?client_id=${encodeURIComponent(
    clientId
  )}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code${configParam}${scopeParam}&state=${encodeURIComponent(state)}`;

  return {
    url: authUrl,
    configIdMissing: !configId,
  };
}

export async function exchangeInstagramCode(
  code: string,
  redirectUri: string
): Promise<OAuthTokenResult> {
  const { clientId, clientSecret } = getCleanInstagramCredentials();

  if (!clientId || !clientSecret) {
    return {
      success: false,
      platform: 'Instagram',
      accountId: '',
      clientName: '',
      accessToken: '',
      error: 'Meta App credentials (META_CLIENT_ID / META_CLIENT_SECRET) missing on server.',
    };
  }

  // 1. Exchange temporary authorization code with Meta Graph API
  // Official Unified Login code exchange endpoint:
  const tokenUrl = `https://graph.facebook.com/v22.0/oauth/access_token?client_id=${encodeURIComponent(
    clientId
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${encodeURIComponent(
    clientSecret
  )}&code=${encodeURIComponent(code)}`;

  const tokenRes = await fetch(tokenUrl);
  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.access_token) {
    const errorDetail =
      tokenData.error?.message ||
      tokenData.error_message ||
      'Failed to exchange Instagram authorization code';
    return {
      success: false,
      platform: 'Instagram',
      accountId: '',
      clientName: '',
      accessToken: '',
      error: `Instagram Unified Login Exchange Failed: ${errorDetail}`,
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
  } catch (longErr) {
    console.warn('[Instagram OAuth] Long-lived exchange notice:', longErr);
  }

  // 3. Fetch assigned Instagram professional accounts via Meta Unified Login endpoint
  let resolvedIgAccountId = '';
  let resolvedIgUsername = '';

  try {
    // Primary Endpoint for Unified Login: /me/assigned_instagram_accounts
    const assignedRes = await fetch(
      `https://graph.facebook.com/v22.0/me/assigned_instagram_accounts?fields=id,username,name,profile_picture_url&access_token=${encodeURIComponent(
        userAccessToken
      )}`
    );
    const assignedData = await assignedRes.json();

    if (assignedRes.ok && Array.isArray(assignedData.data) && assignedData.data.length > 0) {
      const igAcc = assignedData.data[0];
      resolvedIgAccountId = igAcc.id;
      resolvedIgUsername = igAcc.username || igAcc.name || '';
    }
  } catch (assignedErr) {
    console.warn('[Instagram OAuth] assigned_instagram_accounts check notice:', assignedErr);
  }

  // Fallback 1: Query connected Facebook pages that have a linked instagram_business_account
  if (!resolvedIgAccountId) {
    try {
      const pagesRes = await fetch(
        `https://graph.facebook.com/v22.0/me/accounts?fields=id,name,instagram_business_account{id,username,name}&access_token=${encodeURIComponent(
          userAccessToken
        )}`
      );
      const pagesData = await pagesRes.json();

      if (pagesRes.ok && Array.isArray(pagesData.data)) {
        for (const page of pagesData.data) {
          if (page.instagram_business_account?.id) {
            resolvedIgAccountId = page.instagram_business_account.id;
            resolvedIgUsername =
              page.instagram_business_account.username || page.instagram_business_account.name || '';
            break;
          }
        }
      }
    } catch (pageErr) {
      console.warn('[Instagram OAuth] me/accounts lookup notice:', pageErr);
    }
  }

  // Fallback 2: Direct /me query (if token was granted directly to an IG user node)
  if (!resolvedIgAccountId) {
    try {
      const meRes = await fetch(
        `https://graph.facebook.com/v22.0/me?fields=id,username,name&access_token=${encodeURIComponent(
          userAccessToken
        )}`
      );
      const meData = await meRes.json();
      if (meRes.ok && meData.id) {
        resolvedIgAccountId = meData.id;
        resolvedIgUsername = meData.username || meData.name || '';
      }
    } catch (meErr) {
      console.warn('[Instagram OAuth] /me lookup notice:', meErr);
    }
  }

  if (!resolvedIgAccountId) {
    resolvedIgAccountId = `ig-${Date.now()}`;
  }

  if (!resolvedIgUsername) {
    resolvedIgUsername = 'Instagram Account';
  }

  return {
    success: true,
    platform: 'Instagram',
    accountId: resolvedIgAccountId,
    clientName: resolvedIgUsername,
    accessToken: userAccessToken,
    expiresAt,
  };
}

export async function refreshInstagramToken(existingToken: string): Promise<{
  accessToken: string;
  expiresAt?: string;
  success: boolean;
  error?: string;
}> {
  const { clientId, clientSecret } = getCleanInstagramCredentials();
  if (!clientId || !clientSecret) {
    return { accessToken: existingToken, success: false, error: 'Missing Meta credentials for Instagram refresh' };
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
