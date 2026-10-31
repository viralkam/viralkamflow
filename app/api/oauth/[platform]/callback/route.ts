import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { logAudit } from '@/lib/auditLogger';
import {
  getOAuthRedirectUri,
  getCleanFacebookCredentials,
  getCleanInstagramCredentials,
  getCleanThreadsCredentials,
} from '@/lib/oauthUrl';
import { addAccountToUser } from '@/lib/userStore';

/**
 * Server-Side OAuth Callback Handler
 * 
 * Exchanges temporary authorization code for access tokens.
 * Saves tokens securely server-side in Supabase with auto-refresh metadata.
 * Service role keys and secrets never reach the browser bundle.
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
  const rawState = searchParams.get('state');

  let stateAccountId: string | null = null;
  let stateUserId: string | null = request.cookies.get('pf_session_user_id')?.value || 'admin';

  if (rawState) {
    try {
      const decoded = JSON.parse(Buffer.from(rawState, 'base64').toString('utf-8'));
      if (decoded.accountId) stateAccountId = decoded.accountId;
      if (decoded.userId) stateUserId = decoded.userId;
    } catch {
      stateAccountId = rawState;
    }
  }
  if (!stateUserId) stateUserId = 'admin';

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/connect?error=oauth_denied&platform=${platformKey}`, request.url)
    );
  }

  const redirectUri = getOAuthRedirectUri(platformKey, request);

  try {
    let accessToken = '';
    let refreshToken: string | null = null;
    let expiresAt: string | null = null;
    let accountId = '';
    let clientName = '';
    let linkedIgAccount: { id: string; username?: string; name?: string } | null = null;

    if (platformKey === 'instagram') {
      const { clientId: igClientId, clientSecret: igClientSecret } = getCleanInstagramCredentials();
      const { clientId: metaClientId, clientSecret: metaClientSecret } = getCleanFacebookCredentials();

      let igExchangeSuccess = false;

      // 1. Attempt direct Instagram Login OAuth exchange (api.instagram.com)
      try {
        const igTokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: igClientId,
            client_secret: igClientSecret || metaClientSecret || '',
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
            code,
          }),
        });
        const igTokenData = await igTokenRes.json();

        if (igTokenRes.ok && igTokenData.access_token) {
          let igAccessToken = igTokenData.access_token;
          accountId = String(igTokenData.user_id || `ig-${Date.now()}`);

          // Exchange for 60-day long-lived token
          try {
            const longLivedRes = await fetch(
              `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${igClientSecret || metaClientSecret}&access_token=${igAccessToken}`
            );
            const longLivedData = await longLivedRes.json();
            if (longLivedData.access_token) {
              igAccessToken = longLivedData.access_token;
              expiresAt = new Date(Date.now() + (longLivedData.expires_in || 5184000) * 1000).toISOString();
            }
          } catch (longErr) {
            console.warn('[IG OAuth] Long-lived exchange error:', longErr);
          }

          accessToken = igAccessToken;

          // Fetch Instagram profile username
          try {
            const meRes = await fetch(
              `https://graph.instagram.com/v22.0/me?fields=id,username,name&access_token=${accessToken}`
            );
            const meData = await meRes.json();
            clientName = meData.username || meData.name || 'Instagram User';
            if (meData.id) accountId = meData.id;
          } catch {
            clientName = 'Instagram Account';
          }

          igExchangeSuccess = true;
        }
      } catch (igDirectErr) {
        console.warn('[IG OAuth] Direct exchange attempt error:', igDirectErr);
      }

      // 2. If direct exchange did not succeed, fallback to Meta Facebook Graph API exchange
      if (!igExchangeSuccess) {
        const tokenRes = await fetch(
          `https://graph.facebook.com/v22.0/oauth/access_token?client_id=${metaClientId}&redirect_uri=${encodeURIComponent(
            redirectUri
          )}&client_secret=${metaClientSecret}&code=${code}`
        );
        const tokenData = await tokenRes.json();

        if (!tokenRes.ok || !tokenData.access_token) {
          throw new Error(tokenData.error?.message || 'Failed to exchange Instagram access token');
        }

        let userAccessToken = tokenData.access_token;

        try {
          const longLivedRes = await fetch(
            `https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${metaClientId}&client_secret=${metaClientSecret}&fb_exchange_token=${userAccessToken}`
          );
          const longLivedData = await longLivedRes.json();
          if (longLivedData.access_token) {
            userAccessToken = longLivedData.access_token;
            expiresAt = new Date(Date.now() + (longLivedData.expires_in || 5184000) * 1000).toISOString();
          }
        } catch (e) {
          console.warn('Long lived exchange warning:', e);
        }

        let igFound = false;

        // 1. Direct Instagram Accounts linked to Meta user profile (NO FB Pages needed!)
        try {
          const directIgRes = await fetch(
            `https://graph.facebook.com/v22.0/me?fields=id,name,instagram_accounts{id,username,name}&access_token=${userAccessToken}`
          );
          const directIgData = await directIgRes.json();
          if (directIgData.instagram_accounts?.data && directIgData.instagram_accounts.data.length > 0) {
            const directAccount = directIgData.instagram_accounts.data[0];
            accountId = directAccount.id;
            clientName = directAccount.username || directAccount.name || 'Instagram Account';
            accessToken = userAccessToken;
            igFound = true;
          }
        } catch (dirErr) {
          console.warn('[IG Callback] Direct instagram_accounts query warning:', dirErr);
        }

        // 2. Query linked Instagram Business Account from managed pages (fallback)
        if (!igFound) {
          const accountsRes = await fetch(
            `https://graph.facebook.com/v22.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name}&access_token=${userAccessToken}`
          );
          const accountsData = await accountsRes.json();

          if (accountsData.data && Array.isArray(accountsData.data)) {
            for (const page of accountsData.data) {
              if (page.instagram_business_account) {
                accountId = page.instagram_business_account.id;
                clientName = page.instagram_business_account.username || page.instagram_business_account.name || page.name;
                accessToken = page.access_token || userAccessToken;
                igFound = true;
                break;
              }
            }
          }
        }

        if (!igFound) {
          try {
            const meRes2 = await fetch(
              `https://graph.facebook.com/v22.0/me?fields=businesses{owned_pages{id,name,access_token,instagram_business_account{id,username}}}&access_token=${userAccessToken}`
            );
            const meData2 = await meRes2.json();
            const businesses = meData2.businesses?.data || [];
            for (const biz of businesses) {
              const pages = biz.owned_pages?.data || [];
              for (const page of pages) {
                if (page.instagram_business_account) {
                  accountId = page.instagram_business_account.id;
                  clientName = page.instagram_business_account.username || page.name;
                  accessToken = page.access_token || userAccessToken;
                  igFound = true;
                  break;
                }
              }
              if (igFound) break;
            }
          } catch (bizErr) {
            console.warn('[IG Callback] Business portfolio fallback failed:', bizErr);
          }
        }

        if (!igFound) {
          const meRes = await fetch(`https://graph.facebook.com/v22.0/me?access_token=${userAccessToken}`);
          const meData = await meRes.json();
          accountId = meData.id || `meta-${Date.now()}`;
          clientName = meData.name || 'Instagram Account';
          accessToken = userAccessToken;
        }
      }
    } else if (platformKey === 'facebook') {
      const { clientId, clientSecret } = getCleanFacebookCredentials();

      if (!clientId || !clientSecret) {
        return NextResponse.redirect(
          new URL(`/connect?error=oauth_not_configured&platform=facebook`, request.url)
        );
      }

      // 1. Exchange code for short-lived access token
      const tokenRes = await fetch(
        `https://graph.facebook.com/v22.0/oauth/access_token?client_id=${clientId}&redirect_uri=${encodeURIComponent(
          redirectUri
        )}&client_secret=${clientSecret}&code=${code}`
      );
      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || !tokenData.access_token) {
        throw new Error(tokenData.error?.message || 'Failed to exchange Facebook access token');
      }

      let userAccessToken = tokenData.access_token;

      // 2. Exchange for 60-day long-lived access token
      try {
        const longLivedRes = await fetch(
          `https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${userAccessToken}`
        );
        const longLivedData = await longLivedRes.json();
        if (longLivedData.access_token) {
          userAccessToken = longLivedData.access_token;
          expiresAt = new Date(Date.now() + (longLivedData.expires_in || 5184000) * 1000).toISOString();
        }
      } catch (e) {
        console.warn('Long lived exchange warning:', e);
      }

      // 3. Meta Page Access-Token Flow: strictly for Facebook Pages
      const accountsRes = await fetch(
        `https://graph.facebook.com/v22.0/me/accounts?fields=id,name,access_token,category,tasks&access_token=${userAccessToken}`
      );
      const accountsData = await accountsRes.json();

      if (accountsData.data && Array.isArray(accountsData.data) && accountsData.data.length > 0) {
        const targetPage = accountsData.data.find(
          (p: any) => p.tasks?.includes('CREATE_CONTENT') || p.tasks?.includes('MANAGE')
        ) || accountsData.data[0];

        accountId = targetPage.id;
        clientName = targetPage.name;
        accessToken = targetPage.access_token || userAccessToken;
      } else {
        const meRes = await fetch(`https://graph.facebook.com/v22.0/me?access_token=${userAccessToken}`);
        const meData = await meRes.json();
        accountId = meData.id || `meta-${Date.now()}`;
        clientName = meData.name || 'Facebook Page';
        accessToken = userAccessToken;
      }
    } else if (platformKey === 'threads') {
      const { clientId, clientSecret } = getCleanThreadsCredentials();

      if (!clientId || !clientSecret) {
        return NextResponse.redirect(
          new URL(`/connect?error=oauth_not_configured&platform=threads`, request.url)
        );
      }

      // 1. Exchange authorization code for short-lived access token
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
        throw new Error(tokenData.error_message || tokenData.error?.message || 'Failed to exchange Threads token');
      }

      let userAccessToken = tokenData.access_token;
      accountId = String(tokenData.user_id || `threads-${Date.now()}`);

      // 2. Exchange for 60-day long-lived access token
      try {
        const longLivedRes = await fetch(
          `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${clientSecret}&access_token=${userAccessToken}`
        );
        const longLivedData = await longLivedRes.json();
        if (longLivedData.access_token) {
          userAccessToken = longLivedData.access_token;
          expiresAt = new Date(Date.now() + (longLivedData.expires_in || 5184000) * 1000).toISOString();
        }
      } catch (e) {
        console.warn('Threads long lived exchange warning:', e);
      }

      accessToken = userAccessToken;

      // 3. Fetch Threads Profile details
      try {
        const meRes = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username,name&access_token=${accessToken}`);
        const meData = await meRes.json();
        if (meData.username) {
          clientName = meData.username;
          accountId = meData.id || accountId;
        } else {
          clientName = 'Threads User';
        }
      } catch {
        clientName = 'Threads Account';
      }
    }

    const supabase = createServerSupabaseClient();
    const formattedPlatform = platformKey === 'instagram' ? 'Instagram' : platformKey === 'facebook' ? 'Facebook' : 'Threads';

    if (supabase) {
      // 1. Normalize client into clients table
      let clientId: string | null = null;
      try {
        const { data: existingClient } = await supabase
          .from('clients')
          .select('id')
          .eq('name', clientName)
          .single();

        if (existingClient?.id) {
          clientId = existingClient.id;
        } else {
          const { data: newClient } = await supabase
            .from('clients')
            .insert({ name: clientName })
            .select('id')
            .single();
          clientId = newClient?.id || null;
        }
      } catch (err) {
        // Table might be in transition
      }

      // 2. Resolve target account: if state passed an account ID, prioritize updating that row!
      let targetAccountId: string | null = null;
      if (stateAccountId) {
        const { data: accById } = await supabase
          .from('accounts')
          .select('id, client_name')
          .eq('id', stateAccountId)
          .maybeSingle();
        if (accById?.id) {
          targetAccountId = accById.id;
        }
      }

      if (!targetAccountId) {
        const { data: existingAcc } = await supabase
          .from('accounts')
          .select('id')
          .eq('client_name', clientName)
          .eq('platform', formattedPlatform)
          .maybeSingle();
        targetAccountId = existingAcc?.id || null;
      }

      if (targetAccountId) {
        const updatePayload: any = {
          connection_type: 'oauth',
          connection_status: 'Connected',
          oauth_access_token: accessToken,
          oauth_account_id: accountId,
          updated_at: new Date().toISOString(),
        };
        if (clientName && clientName !== 'Instagram Account' && clientName !== 'Facebook Page') {
          updatePayload.client_name = clientName;
        }
        if (refreshToken) updatePayload.oauth_refresh_token = refreshToken;
        if (expiresAt) updatePayload.oauth_token_expires_at = expiresAt;
        if (clientId) updatePayload.client_id = clientId;

        const { error: updateErr } = await supabase
          .from('accounts')
          .update(updatePayload)
          .eq('id', targetAccountId);

        if (updateErr) {
          console.error('[OAuth Callback Update Error]:', updateErr);
        }
      } else {
        targetAccountId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `acc-oauth-${Date.now()}`;
        const insertPayload: any = {
          id: targetAccountId,
          client_name: clientName,
          platform: formattedPlatform,
          connection_type: 'oauth',
          connection_status: 'Connected',
          oauth_access_token: accessToken,
          oauth_refresh_token: refreshToken,
          oauth_account_id: accountId,
          oauth_token_expires_at: expiresAt,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (clientId) insertPayload.client_id = clientId;

        const { error: insertErr } = await supabase.from('accounts').insert(insertPayload);
        if (insertErr) {
          console.error('[OAuth Callback Insert Error]:', insertErr);
        }
      }

      // Save to user-isolated file (Admin or specified user)
      const targetUserId = stateUserId || 'admin';
      if (targetAccountId) {
        await addAccountToUser(targetUserId, {
          id: targetAccountId,
          clientName: clientName || (platformKey === 'facebook' ? 'Facebook Page' : platformKey === 'threads' ? 'Threads Account' : 'Instagram Account'),
          platform: formattedPlatform as any,
          connectionType: 'oauth',
          connectionStatus: 'Connected',
          oauthAccountId: accountId,
          oauthAccessToken: accessToken,
          oauthTokenExpiresAt: expiresAt || undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // 3. Log to audit trail
      try {
        await logAudit({
          action: 'ACCOUNT_CONNECTED_OAUTH',
          entityType: 'account',
          entityId: targetAccountId,
          clientName,
          platform: formattedPlatform,
          status: 'success',
          details: { accountId, expiresAt },
        });
      } catch (auditErr) {
        console.warn('Failed to log OAuth connection audit:', auditErr);
      }
    }

    const safeClientName = (clientName || 'Account').replace(/'/g, "\\'");
    const successHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Connection Successful — Karmflow</title>
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
      <p><strong>${clientName}</strong> connected successfully. Window closing...</p>
    </div>
    <script>
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({
            type: 'OAUTH_SUCCESS',
            platform: '${platformKey}',
            name: '${safeClientName}'
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

    return new NextResponse(successHtml, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (err: any) {
    console.error('OAuth Callback Exchange Error:', err);
    const safeErrMsg = (err.message || 'Authentication exchange failed').replace(/'/g, "\\'");
    const errorHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Connection Error — Karmflow</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #0f172a; }
      .card { background: white; padding: 2.25rem; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08); text-align: center; max-width: 400px; border: 1px solid #fee2e2; }
      .icon { width: 52px; height: 52px; border-radius: 50%; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; font-size: 26px; }
      h2 { margin: 0 0 0.5rem; font-size: 1.3rem; color: #991b1b; }
      p { margin: 0; color: #64748b; font-size: 0.92rem; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon">✕</div>
      <h2>Connection Error</h2>
      <p>${(err.message || 'Authentication exchange failed').replace(/"/g, '&quot;')}</p>
    </div>
    <script>
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({
            type: 'OAUTH_ERROR',
            platform: '${platformKey}',
            message: '${safeErrMsg}'
          }, '*');
          setTimeout(function() { window.close(); }, 2500);
        } else {
          window.location.href = '/connect?error=oauth_exchange_failed&platform=${platformKey}&message=${encodeURIComponent(err.message || '')}';
        }
      } catch (e) {
        window.location.href = '/connect?error=oauth_exchange_failed&platform=${platformKey}';
      }
    </script>
  </body>
</html>`;

    return new NextResponse(errorHtml, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}
