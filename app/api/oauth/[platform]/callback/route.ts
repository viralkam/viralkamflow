import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { logAudit } from '@/lib/auditLogger';
import {
  getOAuthRedirectUri,
  getCleanFacebookCredentials,
  getCleanInstagramCredentials,
  getCleanThreadsCredentials,
  getCleanGoogleCredentials,
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

        // Query linked Instagram Business Account from managed pages
        const accountsRes = await fetch(
          `https://graph.facebook.com/v22.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name}&access_token=${userAccessToken}`
        );
        const accountsData = await accountsRes.json();

        let igFound = false;
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
    } else if (platformKey === 'youtube') {
      const { clientId, clientSecret } = getCleanGoogleCredentials();

      if (!clientId || !clientSecret) {
        return NextResponse.redirect(
          new URL(`/connect?error=oauth_not_configured&platform=youtube`, request.url)
        );
      }

      // Exchange code for tokens via Google OAuth token endpoint
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.access_token) {
        throw new Error(tokenData.error_description || 'Failed to exchange Google access token');
      }

      accessToken = tokenData.access_token;
      if (tokenData.refresh_token) {
        refreshToken = tokenData.refresh_token;
      }
      if (tokenData.expires_in) {
        expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
      }

      // Fetch channel details
      const channelRes = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const channelData = await channelRes.json();
      const firstChannel = channelData.items?.[0];
      accountId = firstChannel?.id || `yt-${Date.now()}`;
      clientName = firstChannel?.snippet?.title || 'YouTube Channel';
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
    const formattedPlatform = platformKey === 'instagram' ? 'Instagram' : platformKey === 'facebook' ? 'Facebook' : platformKey === 'threads' ? 'Threads' : 'YouTube';

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

    return NextResponse.redirect(
      new URL(`/connect?connected=true&platform=${platformKey}&name=${encodeURIComponent(clientName)}`, request.url)
    );
  } catch (err: any) {
    console.error('OAuth Callback Exchange Error:', err);
    return NextResponse.redirect(
      new URL(`/connect?error=oauth_exchange_failed&platform=${platformKey}&message=${encodeURIComponent(err.message || '')}`, request.url)
    );
  }
}
