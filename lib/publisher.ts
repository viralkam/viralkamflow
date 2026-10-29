import { createServerSupabaseClient } from './supabaseServer';
import { getValidAccessToken } from './oauthTokens';
import { logAudit } from './auditLogger';
import { uploadDirectToInstagramReels, uploadDirectToFacebookPage } from './metaDirectUpload';

export interface PublishResult {
  success: boolean;
  externalPostId?: string;
  publishedAt?: string;
  error?: string;
  errorCode?: string | number;
}

/**
 * Unified Server-Side Social Media Publishing Engine
 * 
 * Used by:
 * 1. Immediate Publish Route: /api/publish
 * 2. Automated Scheduled Cron Worker: /api/cron/publish-scheduled
 * 
 * Supports:
 * - Facebook Pages: Photos (/photos), Videos (/videos), Feed Status (/feed)
 * - Instagram Professional / Business:
 *     - Single Photos (valid aspect ratio 4:5 to 1.91:1)
 *     - Reels / Videos (9:16 vertical or 4:5 to 16:9, with container status polling)
 * - Meta Aspect Ratio Error Detection & User-Friendly Hindi/English Explanations
 */
export async function executePublishPost(postId: string): Promise<PublishResult> {
  const supabase = createServerSupabaseClient();

  // 1. Fetch Post (Supabase or Local store)
  let post: any = null;
  if (supabase) {
    try {
      const { data: p } = await supabase.from('posts').select('*').eq('id', postId).single();
      if (p) post = p;
    } catch {}
  }

  if (!post) {
    const { getUserData } = await import('./userStore');
    const adminData = await getUserData('admin');
    const found = adminData?.posts?.find((p: any) => p.id === postId);
    if (found) {
      post = {
        id: found.id,
        account_id: found.accountId,
        client_name: found.clientName,
        platform: found.platform,
        title: found.title,
        caption: found.caption,
        description: found.description,
        media_type: found.mediaType,
        media_url: found.mediaUrl,
        media_name: found.mediaName,
        scheduled_at: found.scheduledAt,
        status: found.status,
      };
    }
  }

  if (!post) {
    throw new Error(`Post with ID ${postId} not found.`);
  }

  const targetClientName = post.client_name;
  const targetPlatform = post.platform;

  // 2. Fetch Associated Account
  let account: any = null;
  if (supabase && post.account_id) {
    try {
      const { data: accById } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', post.account_id)
        .maybeSingle();
      account = accById;
    } catch {}
  }

  if (!account && supabase) {
    try {
      const { data: accByName } = await supabase
        .from('accounts')
        .select('*')
        .eq('client_name', post.client_name)
        .eq('platform', post.platform)
        .maybeSingle();
      account = accByName;
    } catch {}
  }

  if (!account) {
    const { getUserData } = await import('./userStore');
    const adminData = await getUserData('admin');
    const acc = adminData?.accounts?.find((a: any) => a.id === post.account_id || (a.platform === post.platform && a.clientName === post.client_name));
    if (acc) {
      account = {
        id: acc.id,
        client_name: acc.clientName,
        platform: acc.platform,
        connection_type: acc.connectionType,
        connection_status: acc.connectionStatus,
        oauth_access_token: (acc as any).oauthAccessToken || (acc as any).oauth_access_token,
        oauth_account_id: acc.oauthAccountId || (acc as any).oauth_account_id,
      };
    }
  }

  if (!account) {
    const errMsg = `No connected account found for client "${post.client_name}" on ${post.platform}.`;
    if (supabase) await markPostFailed(supabase, post, errMsg);
    return { success: false, error: errMsg };
  }

  // 3. Manual / Mock accounts check
  if (account.connection_type !== 'oauth') {
    const errMsg = `Account "${account.client_name}" is in ${account.connection_type} mode. Real API publishing requires an OAuth-connected account.`;
    return { success: false, error: errMsg };
  }

  if (account.connection_status !== 'Connected') {
    const errMsg = `Account "${account.client_name}" connection status is "${account.connection_status}". Please reconnect via OAuth in Accounts.`;
    await markPostFailed(supabase, post, errMsg);
    return { success: false, error: errMsg };
  }

  // 4. Retrieve & Auto-Refresh Access Token
  let accessToken = '';
  let oauthAccountId = '';
  try {
    const tokenInfo = await getValidAccessToken(account.id);
    accessToken = tokenInfo.accessToken;
    oauthAccountId = tokenInfo.oauthAccountId || '';
  } catch (tokenErr: any) {
    const errMsg = `OAuth token error: ${tokenErr.message}. Please re-link this account in Accounts.`;
    await markPostFailed(supabase, post, errMsg);
    return { success: false, error: errMsg };
  }

  // 5. Build Content Payload
  const messageContent = `${post.title ? post.title + '\n\n' : ''}${post.caption || ''}`.trim();
  const hasMedia = Boolean(post.media_url && post.media_url.startsWith('http'));
  const isVideo = post.media_type === 'video';
  let externalPostId = '';

  try {
    // -------------------------------------------------------------
    // FACEBOOK PUBLISHING
    // -------------------------------------------------------------
    if (account.platform === 'Facebook') {
      const pageId = oauthAccountId || 'me';

      if (hasMedia) {
        if (isVideo) {
          // Stream Video directly to Facebook Page (Zero disk storage)
          const mediaRes = await fetch(post.media_url);
          if (!mediaRes.ok) {
            throw new Error(`Failed to load video file: ${mediaRes.statusText}`);
          }
          const videoBuffer = Buffer.from(await mediaRes.arrayBuffer());
          const fbRes = await uploadDirectToFacebookPage({
            videoBuffer,
            fileName: post.media_name || 'video.mp4',
            title: post.title || '',
            description: messageContent,
            pageId,
            pageAccessToken: accessToken,
          });
          externalPostId = fbRes.videoId;
        } else {
          // Publish Photo to Facebook Page
          const fbRes = await fetch(`https://graph.facebook.com/v22.0/${pageId}/photos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: post.media_url,
              caption: messageContent,
              access_token: accessToken,
            }),
          });
          const fbData = await fbRes.json();
          if (!fbRes.ok || fbData.error) {
            handleMetaApiError(fbData.error);
          }
          externalPostId = fbData.post_id || fbData.id;
        }
      } else {
        // Plain text feed post
        const fbRes = await fetch(`https://graph.facebook.com/v22.0/${pageId}/feed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: messageContent,
            access_token: accessToken,
          }),
        });
        const fbData = await fbRes.json();
        if (!fbRes.ok || fbData.error) {
          handleMetaApiError(fbData.error);
        }
        externalPostId = fbData.id;
      }
    } 
    // -------------------------------------------------------------
    // INSTAGRAM PUBLISHING
    // -------------------------------------------------------------
    else if (account.platform === 'Instagram') {
      const igUserId = oauthAccountId || 'me';

      // 1. Direct Publish of Pre-Uploaded Instagram Container (Zero storage on our server)
      if (post.media_url && post.media_url.startsWith('instagram-container:')) {
        const containerId = post.media_url.replace('instagram-container:', '').trim();
        const publishEndpoint = `https://graph.facebook.com/v22.0/${igUserId}/media_publish`;
        const publishRes = await fetch(`${publishEndpoint}?creation_id=${containerId}&access_token=${accessToken}`, {
          method: 'POST',
        });
        const publishData = await publishRes.json();

        if (!publishRes.ok || publishData.error) {
          handleMetaApiError(publishData.error, true);
        }

        externalPostId = publishData.id || containerId;
      } else if (!hasMedia) {
        throw new Error('Instagram requires a public image or video URL to publish.');
      } else if (isVideo) {
        // Direct Resumable Upload to Instagram Reels (Zero disk / zero Supabase storage)
        const mediaRes = await fetch(post.media_url);
        if (!mediaRes.ok) {
          throw new Error(`Failed to load video file: ${mediaRes.statusText}`);
        }
        const videoBuffer = Buffer.from(await mediaRes.arrayBuffer());
        const igRes = await uploadDirectToInstagramReels({
          videoBuffer,
          fileSizeBytes: videoBuffer.byteLength,
          caption: messageContent,
          igUserId,
          accessToken,
        });
        externalPostId = igRes.postId;
      } else {
        // Step A: Create Image Media Container
        const containerEndpoint = `https://graph.facebook.com/v22.0/${igUserId}/media`;
        const containerParams = new URLSearchParams({
          caption: messageContent,
          access_token: accessToken,
          image_url: post.media_url,
        });

        const containerRes = await fetch(`${containerEndpoint}?${containerParams.toString()}`, {
          method: 'POST',
        });
        const containerData = await containerRes.json();

        if (!containerRes.ok || containerData.error) {
          handleMetaApiError(containerData.error, true);
        }

        const creationId = containerData.id;
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Step B: Publish Image Container
        const publishEndpoint = `https://graph.facebook.com/v22.0/${igUserId}/media_publish`;
        const publishRes = await fetch(`${publishEndpoint}?creation_id=${creationId}&access_token=${accessToken}`, {
          method: 'POST',
        });
        const publishData = await publishRes.json();

        if (!publishRes.ok || publishData.error) {
          handleMetaApiError(publishData.error, true);
        }

        externalPostId = publishData.id;
      }
    }
    // -------------------------------------------------------------
    // THREADS PUBLISHING (Meta Threads API)
    // -------------------------------------------------------------
    else if (account.platform === 'Threads') {
      const threadsUserId = oauthAccountId || 'me';

      // Step A: Create Threads Container (Text, Image, or Video)
      const threadsCreateUrl = `https://graph.threads.net/v1.0/${threadsUserId}/threads`;
      const threadsPayload: Record<string, any> = {
        text: messageContent || post.title || '',
        access_token: accessToken,
      };

      if (hasMedia) {
        if (isVideo) {
          threadsPayload.media_type = 'VIDEO';
          threadsPayload.video_url = post.media_url;
        } else {
          threadsPayload.media_type = 'IMAGE';
          threadsPayload.image_url = post.media_url;
        }
      } else {
        threadsPayload.media_type = 'TEXT';
      }

      const createRes = await fetch(threadsCreateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(threadsPayload),
      });
      const createData = await createRes.json();

      if (!createRes.ok || createData.error) {
        handleMetaApiError(createData.error);
      }

      const creationId = createData.id;

      // Wait a moment for container processing
      await new Promise((resolve) => setTimeout(resolve, isVideo ? 5000 : 2500));

      // Step B: Publish Threads Container
      const publishRes = await fetch(`https://graph.threads.net/v1.0/${threadsUserId}/threads_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: creationId,
          access_token: accessToken,
        }),
      });
      const publishData = await publishRes.json();

      if (!publishRes.ok || publishData.error) {
        handleMetaApiError(publishData.error);
      }

      externalPostId = publishData.id;
    }

    // Success: Mark post as posted
    const publishedAt = new Date().toISOString();
    if (supabase) {
      await supabase
        .from('posts')
        .update({
          status: 'posted',
          published_at: publishedAt,
          retry_count: 0,
          last_error: null,
          updated_at: publishedAt,
        })
        .eq('id', postId);

      // If media was a temporary transit file, purge it now that it is published (0 MB permanent storage)
      if (post.media_url && post.media_url.includes('temp-transit/')) {
        try {
          const parts = post.media_url.split('/media/');
          if (parts[1]) {
            const path = decodeURIComponent(parts[1].split('?')[0]);
            await supabase.storage.from('media').remove([path]);
            console.log(`[Scheduled Zero-Storage Cleanup]: Purged transit file ${path}`);
          }
        } catch (cleanErr) {
          console.warn('Transit purge warning:', cleanErr);
        }
      }
    }

    await logAudit({
      action: 'POST_PUBLISHED',
      entityType: 'post',
      entityId: postId,
      clientName: targetClientName,
      platform: targetPlatform,
      status: 'success',
      details: { externalPostId, publishedAt },
    });

    return {
      success: true,
      externalPostId,
      publishedAt,
    };
  } catch (err: any) {
    console.error(`[Publisher Error] Post ${postId}:`, err);
    await markPostFailed(supabase, post, err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Handle and normalize Meta (Facebook & Instagram) API errors
 * giving clear, actionable guidance on Aspect Ratio, Permissions, and Formats.
 */
function handleMetaApiError(errorObj: any, isInstagram = false): never {
  const code = errorObj?.code;
  const subcode = errorObj?.error_subcode;
  const msg = (errorObj?.message || 'Meta API error').toLowerCase();

  // Aspect Ratio Mismatch Error
  if (
    code === 36003 || 
    subcode === 2207009 || 
    msg.includes('aspect ratio') || 
    msg.includes('image ratio')
  ) {
    throw new Error(
      'Aspect Ratio Mismatch: Instagram Feed requires an image ratio between 4:5 (portrait) and 1.91:1 (landscape). ' +
      'Please use the "Fit to 1:1" or "Fit to 4:5" button in the media preview before publishing.'
    );
  }

  // Token expired / permissions
  if (code === 190 || subcode === 463 || msg.includes('access token') || msg.includes('session has expired')) {
    throw new Error('Meta Access Token expired or permissions revoked. Please re-link your Facebook/Instagram account in the Accounts tab.');
  }

  // Media download error from Meta
  if (msg.includes('failed to download') || msg.includes('url') || code === 352) {
    throw new Error('Meta servers could not access the media URL. Please make sure the uploaded image or video is publicly reachable.');
  }

  // Generic Meta error with original message
  throw new Error(`${isInstagram ? 'Instagram' : 'Facebook'} API Error: ${errorObj?.message || 'Request rejected by Meta servers.'}`);
}

async function markPostFailed(supabase: any, post: any, errorMessage: string) {
  try {
    const currentRetries = (post.retry_count || 0) + 1;
    const maxRetries = post.max_retries || 3;
    const nextStatus = currentRetries >= maxRetries ? 'failed' : 'scheduled';

    await supabase
      .from('posts')
      .update({
        retry_count: currentRetries,
        last_error: errorMessage,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', post.id);

    await logAudit({
      action: 'PUBLISH_FAILED',
      entityType: 'post',
      entityId: post.id,
      clientName: post.client_name,
      platform: post.platform,
      status: 'failed',
      details: { error: errorMessage, retryCount: currentRetries, maxRetries },
    });
  } catch (auditErr) {
    console.warn('Failed to update failure state:', auditErr);
  }
}
