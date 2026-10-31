import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { logAudit } from '@/lib/auditLogger';
import { addAccountToUser, getUserData, saveUserData } from '@/lib/userStore';
import { getD1Config, saveD1Account, deleteD1Account } from '@/lib/cloudflareD1';
import { Platform } from '@/types';
import { OAuthTokenResult } from './types';

/**
 * Persists an OAuth-connected account across all storage layers:
 * 1. Supabase Postgres DB (if configured)
 * 2. Cloudflare D1 Serverless DB (if configured)
 * 3. Local filesystem userStore
 * 
 * Guarantees total platform isolation:
 * An Instagram connection ONLY creates or updates an Instagram record.
 * A Facebook connection ONLY creates or updates a Facebook record.
 * A Threads connection ONLY creates or updates a Threads record.
 */
export async function saveConnectedOAuthAccount(
  tokenResult: OAuthTokenResult,
  userId = 'admin',
  targetAccountId?: string | null
): Promise<{ accountId: string }> {
  const { platform, accountId: oauthAccountId, clientName, accessToken, refreshToken, expiresAt } = tokenResult;

  const now = new Date().toISOString();
  let finalAccountId = targetAccountId || null;

  // 1. Supabase Database
  const supabase = createServerSupabaseClient();
  if (supabase) {
    try {
      // Find matching existing account for this specific platform
      if (!finalAccountId) {
        const { data: existingAcc } = await supabase
          .from('accounts')
          .select('id')
          .eq('platform', platform)
          .or(`oauth_account_id.eq.${oauthAccountId},client_name.eq.${clientName}`)
          .maybeSingle();

        if (existingAcc?.id) {
          finalAccountId = existingAcc.id;
        }
      }

      if (finalAccountId) {
        await supabase
          .from('accounts')
          .update({
            client_name: clientName,
            platform,
            connection_type: 'oauth',
            connection_status: 'Connected',
            oauth_access_token: accessToken,
            oauth_account_id: oauthAccountId,
            ...(refreshToken ? { oauth_refresh_token: refreshToken } : {}),
            ...(expiresAt ? { oauth_token_expires_at: expiresAt } : {}),
            updated_at: now,
          })
          .eq('id', finalAccountId);
      } else {
        finalAccountId = crypto.randomUUID ? crypto.randomUUID() : `acc-${platform.toLowerCase()}-${Date.now()}`;
        await supabase.from('accounts').insert({
          id: finalAccountId,
          client_name: clientName,
          platform,
          connection_type: 'oauth',
          connection_status: 'Connected',
          oauth_access_token: accessToken,
          oauth_account_id: oauthAccountId,
          ...(refreshToken ? { oauth_refresh_token: refreshToken } : {}),
          ...(expiresAt ? { oauth_token_expires_at: expiresAt } : {}),
          created_at: now,
          updated_at: now,
        });
      }
    } catch (dbErr) {
      console.warn('[AccountStore Supabase Error]:', dbErr);
    }
  }

  if (!finalAccountId) {
    finalAccountId = crypto.randomUUID ? crypto.randomUUID() : `acc-${platform.toLowerCase()}-${Date.now()}`;
  }

  // 2. Cloudflare D1 Database
  try {
    const { isConfigured } = getD1Config();
    if (isConfigured) {
      await saveD1Account(userId, {
        id: finalAccountId,
        clientName,
        platform: platform as Platform,
        connectionType: 'oauth',
        connectionStatus: 'Connected',
        oauthAccountId,
        oauthAccessToken: accessToken,
        oauthRefreshToken: refreshToken || undefined,
        oauthTokenExpiresAt: expiresAt || undefined,
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch (d1Err) {
    console.warn('[AccountStore D1 Error]:', d1Err);
  }

  // 3. Local filesystem userStore
  try {
    await addAccountToUser(userId, {
      id: finalAccountId,
      clientName,
      platform: platform as Platform,
      connectionType: 'oauth',
      connectionStatus: 'Connected',
      oauthAccountId,
      oauthAccessToken: accessToken,
      oauthTokenExpiresAt: expiresAt || undefined,
      createdAt: now,
      updatedAt: now,
    });
  } catch (storeErr) {
    console.warn('[AccountStore userStore Error]:', storeErr);
  }

  // 4. Audit Trail Logging
  try {
    await logAudit({
      action: 'ACCOUNT_CONNECTED_OAUTH',
      entityType: 'account',
      entityId: finalAccountId,
      clientName,
      platform,
      status: 'success',
      details: { oauthAccountId, expiresAt },
    });
  } catch {}

  return { accountId: finalAccountId };
}

/**
 * Disconnect an account completely across all data stores.
 */
export async function disconnectOAuthAccount(
  accountId: string,
  platform: string,
  userId = 'admin'
): Promise<boolean> {
  // 1. Supabase
  const supabase = createServerSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('accounts').delete().eq('id', accountId);
    } catch (e) {
      console.warn('[Disconnect Supabase Notice]:', e);
    }
  }

  // 2. Cloudflare D1
  try {
    await deleteD1Account(accountId);
  } catch (e) {
    console.warn('[Disconnect D1 Notice]:', e);
  }

  // 3. Local UserStore
  try {
    const uData = await getUserData(userId);
    if (uData) {
      uData.accounts = (uData.accounts || []).filter((a: { id: string }) => a.id !== accountId);
      await saveUserData(userId, uData);
    }
  } catch (e) {
    console.warn('[Disconnect UserStore Notice]:', e);
  }

  // 4. Audit Log
  try {
    await logAudit({
      action: 'ACCOUNT_DISCONNECTED',
      entityType: 'account',
      entityId: accountId,
      platform,
      status: 'success',
    });
  } catch {}

  return true;
}

/**
 * Generates an OAuth popup completion response HTML.
 * Communicates success with window.opener.postMessage and closes automatically.
 */
export function renderOAuthSuccessHtml(platform: string, clientName: string): string {
  const safeName = (clientName || 'Account').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  const platformKey = platform.toLowerCase();

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${platform} Connected — ViralKamFlow</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #0f172a; }
      .card { background: white; padding: 2.25rem; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08); text-align: center; max-width: 380px; border: 1px solid #e2e8f0; }
      .icon { width: 52px; height: 52px; border-radius: 50%; background: #dcfce7; color: #16a34a; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; font-size: 26px; }
      h2 { margin: 0 0 0.5rem; font-size: 1.3rem; }
      p { margin: 0; color: #64748b; font-size: 0.92rem; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon">✓</div>
      <h2>Connected!</h2>
      <p><strong>${safeName}</strong> connected successfully to ${platform}. Closing window...</p>
    </div>
    <script>
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({
            type: 'OAUTH_SUCCESS',
            platform: '${platformKey}',
            name: '${safeName}'
          }, '*');
          setTimeout(function() { window.close(); }, 600);
        } else {
          window.location.href = '/connect?connected=true&platform=${platformKey}&name=${encodeURIComponent(clientName)}';
        }
      } catch (e) {
        window.location.href = '/connect?connected=true&platform=${platformKey}&name=${encodeURIComponent(clientName)}';
      }
    </script>
  </body>
</html>`;
}

/**
 * Generates an OAuth popup error response HTML.
 */
export function renderOAuthErrorHtml(platform: string, errorMessage: string): string {
  const safeErr = (errorMessage || 'Authentication failed').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  const platformKey = platform.toLowerCase();

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Connection Error — ViralKamFlow</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #0f172a; }
      .card { background: white; padding: 2.25rem; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08); text-align: center; max-width: 420px; border: 1px solid #fee2e2; }
      .icon { width: 52px; height: 52px; border-radius: 50%; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; font-size: 26px; }
      h2 { margin: 0 0 0.5rem; font-size: 1.3rem; color: #991b1b; }
      p { margin: 0; color: #64748b; font-size: 0.92rem; line-height: 1.5; word-break: break-word; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon">✕</div>
      <h2>Connection Notice</h2>
      <p>${safeErr}</p>
    </div>
    <script>
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({
            type: 'OAUTH_ERROR',
            platform: '${platformKey}',
            message: '${safeErr}'
          }, '*');
          setTimeout(function() { window.close(); }, 3500);
        } else {
          window.location.href = '/connect?error=oauth_failed&platform=${platformKey}&message=${encodeURIComponent(errorMessage)}';
        }
      } catch (e) {
        window.location.href = '/connect?error=oauth_failed&platform=${platformKey}';
      }
    </script>
  </body>
</html>`;
}
