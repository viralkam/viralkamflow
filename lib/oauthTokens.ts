import { createServerSupabaseClient } from './supabaseServer';
import { logAudit } from './auditLogger';
import { refreshFacebookToken } from './oauth/facebookService';
import { refreshInstagramToken } from './oauth/instagramService';
import { refreshThreadsToken } from './oauth/threadsService';
import { getUserData, saveUserData } from './userStore';
import { getD1Config, saveD1Account } from './cloudflareD1';

/**
 * Server-Side OAuth Token Manager with Automatic Refresh
 * 
 * CRITICAL SECURITY:
 * - Tokens and secrets NEVER leave the server.
 * - Auto-refreshes Meta, Instagram and Threads tokens when expired or nearing expiration (< 24 hours).
 * - Seamlessly supports Supabase, Cloudflare D1, and local userStore.
 */
export async function getValidAccessToken(accountId: string): Promise<{
  accessToken: string;
  platform: string;
  oauthAccountId?: string;
  clientName: string;
}> {
  const supabase = createServerSupabaseClient();
  let account: any = null;
  let source: 'supabase' | 'userStore' = 'supabase';
  let userStoreUserId = 'admin';

  // 1. Try Supabase if configured
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .or(`id.eq.${accountId},oauth_account_id.eq.${accountId}`)
        .maybeSingle();

      if (!error && data) {
        account = data;
        source = 'supabase';
      }
    } catch (e) {
      console.warn('[getValidAccessToken] Supabase lookup error:', e);
    }
  }

  // 2. Fallback to userStore if not found in Supabase
  if (!account) {
    const adminData = await getUserData('admin');
    const acc = adminData?.accounts?.find(
      (a: any) => a.id === accountId || a.oauthAccountId === accountId
    );
    if (acc) {
      account = {
        id: acc.id,
        client_name: acc.clientName,
        platform: acc.platform,
        connection_type: acc.connectionType,
        oauth_access_token: acc.oauthAccessToken,
        oauth_account_id: acc.oauthAccountId,
        oauth_token_expires_at: acc.oauthTokenExpiresAt,
      };
      source = 'userStore';
      userStoreUserId = 'admin';
    }
  }

  if (!account) {
    throw new Error(`Account not found for ID: ${accountId}`);
  }

  if (account.connection_type !== 'oauth') {
    throw new Error('Account is not an OAuth-connected account.');
  }

  if (!account.oauth_access_token) {
    throw new Error('No access token found for account. Please reconnect via OAuth.');
  }

  const now = Date.now();
  const expiresAt = account.oauth_token_expires_at ? new Date(account.oauth_token_expires_at).getTime() : null;
  // If expiring in next 24 hours, auto-refresh
  const isExpiringSoon = expiresAt ? (expiresAt - now) < 24 * 60 * 60 * 1000 : false;

  // If token is still valid, return it directly
  if (!isExpiringSoon && account.oauth_access_token) {
    return {
      accessToken: account.oauth_access_token,
      platform: account.platform,
      oauthAccountId: account.oauth_account_id,
      clientName: account.client_name,
    };
  }

  // Auto-refresh based on platform
  let refreshedToken = account.oauth_access_token;
  let newExpiresAt: string | null = null;

  try {
    if (account.platform === 'Facebook') {
      const res = await refreshFacebookToken(account.oauth_access_token);
      if (res.success && res.accessToken) {
        refreshedToken = res.accessToken;
        newExpiresAt = res.expiresAt || null;
      }
    } else if (account.platform === 'Instagram') {
      const res = await refreshInstagramToken(account.oauth_access_token);
      if (res.success && res.accessToken) {
        refreshedToken = res.accessToken;
        newExpiresAt = res.expiresAt || null;
      }
    } else if (account.platform === 'Threads') {
      const res = await refreshThreadsToken(account.oauth_access_token);
      if (res.success && res.accessToken) {
        refreshedToken = res.accessToken;
        newExpiresAt = res.expiresAt || null;
      }
    }

    // Persist refreshed token server-side
    if (refreshedToken !== account.oauth_access_token) {
      if (supabase && source === 'supabase') {
        await supabase
          .from('accounts')
          .update({
            oauth_access_token: refreshedToken,
            ...(newExpiresAt ? { oauth_token_expires_at: newExpiresAt } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq('id', account.id);
      }

      // Also update in Cloudflare D1
      try {
        const { isConfigured } = getD1Config();
        if (isConfigured) {
          await saveD1Account(userStoreUserId, {
            id: account.id,
            clientName: account.client_name,
            platform: account.platform,
            connectionType: 'oauth',
            connectionStatus: 'Connected',
            oauthAccountId: account.oauth_account_id,
            oauthAccessToken: refreshedToken,
            oauthTokenExpiresAt: newExpiresAt || undefined,
            createdAt: account.created_at || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (d1Err) {
        console.warn('[D1 token refresh update notice]:', d1Err);
      }

      // Also update in userStore
      try {
        const uData = await getUserData(userStoreUserId);
        if (uData) {
          const accIdx = uData.accounts.findIndex(
            (a: any) => a.id === account.id || a.oauthAccountId === account.oauth_account_id
          );
          if (accIdx >= 0) {
            uData.accounts[accIdx].oauthAccessToken = refreshedToken;
            if (newExpiresAt) uData.accounts[accIdx].oauthTokenExpiresAt = newExpiresAt;
            uData.accounts[accIdx].updatedAt = new Date().toISOString();
            await saveUserData(userStoreUserId, uData);
          }
        }
      } catch (storeErr) {
        console.warn('[userStore update token warning]:', storeErr);
      }

      await logAudit({
        action: 'TOKEN_REFRESHED',
        entityType: 'account',
        entityId: account.id,
        clientName: account.client_name,
        platform: account.platform,
        status: 'success',
        details: { expiresAt: newExpiresAt },
      });
    }
  } catch (err: any) {
    console.warn(`[OAuth Auto-Refresh Failed]: ${err.message}. Proceeding with current token.`);
    await logAudit({
      action: 'TOKEN_REFRESH_FAILED',
      entityType: 'account',
      entityId: account.id,
      clientName: account.client_name,
      platform: account.platform,
      status: 'warning',
      details: { error: err.message },
    });
  }

  return {
    accessToken: refreshedToken,
    platform: account.platform,
    oauthAccountId: account.oauth_account_id,
    clientName: account.client_name,
  };
}
