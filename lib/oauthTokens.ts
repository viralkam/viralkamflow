import { createServerSupabaseClient } from './supabaseServer';
import { logAudit } from './auditLogger';
import { getCleanMetaCredentials, getCleanGoogleCredentials } from './oauthUrl';

/**
 * Server-Side OAuth Token Manager with Automatic Refresh
 * 
 * CRITICAL SECURITY:
 * - Tokens and secrets NEVER leave the server.
 * - Auto-refreshes Google and Meta tokens when expired or nearing expiration.
 */
export async function getValidAccessToken(accountId: string): Promise<{
  accessToken: string;
  platform: string;
  oauthAccountId?: string;
  clientName: string;
}> {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase server configuration is missing.');
  }

  const { data: account, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', accountId)
    .single();

  if (error || !account) {
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
  const isExpiringSoon = expiresAt ? (expiresAt - now) < 5 * 60 * 1000 : false;

  // If token is still valid, return it
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
    if (account.platform === 'YouTube') {
      const { clientId, clientSecret } = getCleanGoogleCredentials();
      const refreshToken = account.oauth_refresh_token;

      if (!clientId || !clientSecret) {
        throw new Error('Missing Google OAuth client credentials.');
      }

      if (!refreshToken) {
        // If no refresh token exists, use existing token or prompt re-auth
        return {
          accessToken: account.oauth_access_token,
          platform: account.platform,
          oauthAccountId: account.oauth_account_id,
          clientName: account.client_name,
        };
      }

      console.log(`[OAuth Auto-Refresh]: Refreshing Google access token for account ${account.client_name}...`);
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      const refreshData = await refreshRes.json();
      if (!refreshRes.ok || !refreshData.access_token) {
        throw new Error(refreshData.error_description || 'Failed to refresh Google token');
      }

      refreshedToken = refreshData.access_token;
      newExpiresAt = new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString();
    } else if (account.platform === 'Facebook') {
      const { clientId, clientSecret } = getCleanMetaCredentials();

      if (!clientId || !clientSecret) {
        throw new Error('Missing Meta OAuth client credentials.');
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
      const { clientId, clientSecret } = getCleanMetaCredentials();

      if (!clientId || !clientSecret) {
        throw new Error('Missing Meta OAuth client credentials.');
      }

      console.log(`[OAuth Auto-Refresh]: Refreshing Instagram token for account ${account.client_name}...`);
      let refreshed = false;

      // 1. Try Instagram refresh endpoint (for direct Instagram Login)
      try {
        const igRefreshRes = await fetch(
          `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${account.oauth_access_token}`
        );
        const igRefreshData = await igRefreshRes.json();
        if (igRefreshRes.ok && igRefreshData.access_token) {
          refreshedToken = igRefreshData.access_token;
          newExpiresAt = new Date(Date.now() + (igRefreshData.expires_in || 5184000) * 1000).toISOString();
          refreshed = true;
        }
      } catch {}

      // 2. Fallback to Meta exchange endpoint (for Page-linked Instagram tokens)
      if (!refreshed) {
        try {
          const metaRes = await fetch(
            `https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${account.oauth_access_token}`
          );
          const metaData = await metaRes.json();
          if (metaRes.ok && metaData.access_token) {
            refreshedToken = metaData.access_token;
            newExpiresAt = new Date(Date.now() + (metaData.expires_in || 5184000) * 1000).toISOString();
          }
        } catch {}
      }
    } else if (account.platform === 'Threads') {
      const { clientSecret } = getCleanMetaCredentials();

      if (!clientSecret) {
        throw new Error('Missing Meta OAuth client secret for Threads.');
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

    // Update refreshed token in Supabase server-side
    if (refreshedToken !== account.oauth_access_token) {
      await supabase
        .from('accounts')
        .update({
          oauth_access_token: refreshedToken,
          ...(newExpiresAt ? { oauth_token_expires_at: newExpiresAt } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', account.id);

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
