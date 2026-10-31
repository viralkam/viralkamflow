import { createServerSupabaseClient } from './supabaseServer';
import { logAudit } from './auditLogger';
import {
  getCleanFacebookCredentials,
  getCleanInstagramCredentials,
  getCleanThreadsCredentials,
} from './oauthUrl';
import { getUserData, saveUserData } from './userStore';

/**
 * Server-Side OAuth Token Manager with Automatic Refresh
 * 
 * CRITICAL SECURITY:
 * - Tokens and secrets NEVER leave the server.
 * - Auto-refreshes Meta and Threads tokens when expired or nearing expiration (< 24 hours).
 * - Seamlessly supports both Supabase database and local userStore.
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
      const { clientId, clientSecret } = getCleanFacebookCredentials();

      if (!clientId || !clientSecret) {
        throw new Error('Missing Facebook OAuth client credentials.');
      }

      console.log(`[OAuth Auto-Refresh]: Refreshing Facebook token for account ${account.client_name}...`);
      const metaRes = await fetch(
        `https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${account.oauth_access_token}`
      );

      const metaData = await metaRes.json();
      if (metaRes.ok && metaData.access_token) {
        refreshedToken = metaData.access_token;
        newExpiresAt = new Date(Date.now() + (metaData.expires_in || 5184000) * 1000).toISOString();
      }
    } else if (account.platform === 'Instagram') {
      console.log(`[OAuth Auto-Refresh]: Refreshing Instagram token for account ${account.client_name}...`);
      try {
        const igRefreshRes = await fetch(
          `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${account.oauth_access_token}`
        );
        const igRefreshData = await igRefreshRes.json();
        if (igRefreshRes.ok && igRefreshData.access_token) {
          refreshedToken = igRefreshData.access_token;
          newExpiresAt = new Date(Date.now() + (igRefreshData.expires_in || 5184000) * 1000).toISOString();
        }
      } catch (igRefreshErr) {
        console.warn('[OAuth Auto-Refresh] Instagram refresh error:', igRefreshErr);
      }
    } else if (account.platform === 'Threads') {
      const { clientSecret } = getCleanThreadsCredentials();

      if (!clientSecret) {
        throw new Error('Missing Threads OAuth client secret.');
      }

      console.log(`[OAuth Auto-Refresh]: Refreshing Threads token for account ${account.client_name}...`);
      try {
        const thRes = await fetch(
          `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${clientSecret}&access_token=${account.oauth_access_token}`
        );
        const thData = await thRes.json();
        if (thRes.ok && thData.access_token) {
          refreshedToken = thData.access_token;
          newExpiresAt = new Date(Date.now() + (thData.expires_in || 5184000) * 1000).toISOString();
        }
      } catch (thErr) {
        console.warn('Threads token refresh warning:', thErr);
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
