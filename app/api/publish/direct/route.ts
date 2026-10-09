import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getValidAccessToken } from '@/lib/oauthTokens';
import { uploadDirectToInstagramReels, uploadDirectToFacebookPage } from '@/lib/metaDirectUpload';
import { logAudit } from '@/lib/auditLogger';

/**
 * Direct Upload & Publish Route (Zero Server Disk, Zero Supabase Storage)
 * 
 * Streams incoming video binary buffer directly from in-memory request to:
 * - Meta Resumable Upload (rupload.facebook.com) for Instagram Reels
 * - Facebook Video Graph API (graph-video.facebook.com) for Facebook Page Videos
 * - YouTube Resumable API for YouTube Videos
 * 
 * Only post metadata (title, caption, external post ID) is stored in Supabase DB.
 * Video files are NEVER saved to server disk or Supabase Storage!
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase server configuration missing.' }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const mediaUrlParam = (formData.get('mediaUrl') as string) || '';
    const title = (formData.get('title') as string) || '';
    const caption = (formData.get('caption') as string) || '';
    const description = (formData.get('description') as string) || '';
    const tagsRaw = (formData.get('tags') as string) || '[]';
    const accountIdsRaw = (formData.get('accountIds') as string) || '[]';

    let tags: string[] = [];
    try {
      tags = JSON.parse(tagsRaw);
    } catch {
      tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
    }

    let accountIds: string[] = [];
    try {
      accountIds = JSON.parse(accountIdsRaw);
    } catch {
      accountIds = accountIdsRaw ? [accountIdsRaw] : [];
    }

    if (!file && !mediaUrlParam && !caption.trim() && !title.trim()) {
      return NextResponse.json({ error: 'Media file or text caption is required.' }, { status: 400 });
    }

    if (accountIds.length === 0) {
      return NextResponse.json({ error: 'At least one account must be selected.' }, { status: 400 });
    }

    // Convert incoming file or mediaUrl to in-memory Buffer (Zero disk writes)
    let videoBuffer: Buffer | null = null;
    let fileSizeBytes = 0;
    let isVideo = file ? file.type.startsWith('video') : false;

    if (file) {
      videoBuffer = Buffer.from(await file.arrayBuffer());
      fileSizeBytes = videoBuffer.byteLength;
    } else if (mediaUrlParam) {
      try {
        const fetchRes = await fetch(mediaUrlParam);
        if (fetchRes.ok) {
          const ab = await fetchRes.arrayBuffer();
          videoBuffer = Buffer.from(ab);
          fileSizeBytes = videoBuffer.byteLength;
          const ct = fetchRes.headers.get('content-type') || '';
          isVideo = ct.includes('video') || mediaUrlParam.includes('.mp4') || mediaUrlParam.includes('.mov');
        }
      } catch (fErr) {
        console.warn('Direct mediaUrl fetch failed, will pass URL if needed:', fErr);
      }
    }

    const scheduleTimesRaw = formData.get('scheduleTimes') as string | null;
    const scheduleTimeRaw = formData.get('scheduleTime') as string | null;

    let scheduleTimesList: Array<{ seconds: number | null; iso: string | null }> = [];
    if (scheduleTimesRaw) {
      try {
        const parsed = JSON.parse(scheduleTimesRaw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            const d = new Date(item);
            if (!isNaN(d.getTime())) {
              scheduleTimesList.push({
                seconds: Math.floor(d.getTime() / 1000),
                iso: d.toISOString(),
              });
            }
          }
        }
      } catch {}
    }

    if (scheduleTimesList.length === 0 && scheduleTimeRaw) {
      const d = new Date(scheduleTimeRaw);
      if (!isNaN(d.getTime())) {
        scheduleTimesList.push({
          seconds: Math.floor(d.getTime() / 1000),
          iso: d.toISOString(),
        });
      }
    }

    const targetSlots = scheduleTimesList.length > 0 ? scheduleTimesList : [{ seconds: null, iso: null }];

    const results: Array<{
      accountId: string;
      platform: string;
      clientName: string;
      success: boolean;
      externalPostId?: string;
      scheduledAt?: string | null;
      error?: string;
    }> = [];

    // Fetch accounts from Supabase
    const { data: accounts, error: accErr } = await supabase
      .from('accounts')
      .select('*')
      .in('id', accountIds);

    if (accErr || !accounts || accounts.length === 0) {
      return NextResponse.json({ error: 'Selected accounts could not be found.' }, { status: 404 });
    }

    for (const account of accounts) {
      for (const slot of targetSlots) {
        const scheduleTimeSeconds = slot.seconds;
        const scheduledAtIso = slot.iso;
        try {
          if (account.connection_status !== 'Connected' || account.connection_type !== 'oauth') {
            throw new Error(`Account "${account.client_name}" (${account.platform}) is not actively connected via OAuth.`);
          }

          const { accessToken, oauthAccountId } = await getValidAccessToken(account.id);
          let externalPostId = '';
          const messageContent = `${title ? title + '\n\n' : ''}${caption}`.trim();

        // -----------------------------------------------------------------
        // 1. INSTAGRAM REELS (Direct Resumable Upload or Transit URL)
        // -----------------------------------------------------------------
        if (account.platform === 'Instagram') {
          const igUserId = oauthAccountId || 'me';

          // NOTE: Meta Instagram Graph API rejects scheduled_publish_time with "(#3) User must be on whitelist".
          // Standard developer accounts CANNOT use native Meta scheduling on Instagram.
          // Therefore, scheduled posts are saved to the database (status: 'scheduled')
          // and published automatically at the scheduled time by our background worker / cron!
          if (scheduleTimeSeconds) {
            externalPostId = `scheduled-ig-${Date.now()}`;
          } else if (videoBuffer) {
            const igRes = await uploadDirectToInstagramReels({
              videoBuffer,
              fileSizeBytes,
              caption: messageContent,
              igUserId,
              accessToken,
            });
            externalPostId = igRes.postId;
          } else if (mediaUrlParam) {
            // Meta downloads directly from transit URL for immediate publishing
            const containerBody: Record<string, any> = {
              media_type: 'REELS',
              video_url: mediaUrlParam,
              caption: messageContent,
              access_token: accessToken,
            };

            const isDirectIg = accessToken.startsWith('IG');
            const igHost = isDirectIg ? 'graph.instagram.com' : 'graph.facebook.com';
            const igTarget = isDirectIg ? 'me' : igUserId;

            const initRes = await fetch(`https://${igHost}/v22.0/${igTarget}/media`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(containerBody),
            });
            const initData = await initRes.json();
            if (!initRes.ok || !initData.id) {
              throw new Error(initData?.error?.message || 'Instagram Reels container creation failed');
            }
            const containerId = initData.id;

            // Wait for Meta to finish downloading from transit URL
            let isReady = false;
            for (let i = 0; i < 20; i++) {
              await new Promise((r) => setTimeout(r, 3000));
              const statusRes = await fetch(
                `https://${igHost}/v22.0/${containerId}?fields=status_code,status&access_token=${accessToken}`
              );
              const statusData = await statusRes.json();
              if (statusData.status_code === 'FINISHED') {
                isReady = true;
                break;
              } else if (statusData.status_code === 'ERROR') {
                throw new Error('Meta video processing failed. Please ensure 9:16 vertical MP4 format.');
              }
            }

            const pubRes = await fetch(`https://${igHost}/v22.0/${igTarget}/media_publish`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
            });
            const pubData = await pubRes.json();
            if (!pubRes.ok || !pubData.id) {
              throw new Error(pubData?.error?.message || 'Instagram Reels publish failed');
            }
            externalPostId = pubData.id;
          } else {
            throw new Error('Instagram Reels requires a video file or valid video URL.');
          }
        } 
        // -----------------------------------------------------------------
        // 2. FACEBOOK PAGE (Direct Multipart or Transit URL)
        // -----------------------------------------------------------------
        else if (account.platform === 'Facebook') {
          const pageId = oauthAccountId || 'me';

          if (videoBuffer && isVideo) {
            const fbRes = await uploadDirectToFacebookPage({
              videoBuffer,
              fileName: file?.name || 'video.mp4',
              title,
              description: caption,
              pageId,
              pageAccessToken: accessToken,
              scheduleTimeSeconds,
            });
            externalPostId = fbRes.videoId;
          } else if (mediaUrlParam && isVideo) {
            const fbBody: Record<string, any> = {
              file_url: mediaUrlParam,
              title: title || undefined,
              description: messageContent,
              access_token: accessToken,
            };
            if (scheduleTimeSeconds) {
              fbBody.published = false;
              fbBody.scheduled_publish_time = scheduleTimeSeconds;
            }
            const fbRes = await fetch(`https://graph.facebook.com/v22.0/${pageId}/videos`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(fbBody),
            });
            const fbData = await fbRes.json();
            if (!fbRes.ok || !fbData.id) {
              throw new Error(fbData?.error?.message || 'Facebook video upload failed');
            }
            externalPostId = fbData.id;
          } else if (mediaUrlParam && !isVideo) {
            const fbRes = await fetch(`https://graph.facebook.com/v22.0/${pageId}/photos`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                url: mediaUrlParam,
                caption: messageContent,
                access_token: accessToken,
              }),
            });
            const fbData = await fbRes.json();
            if (!fbRes.ok || (!fbData.id && !fbData.post_id)) {
              throw new Error(fbData?.error?.message || 'Facebook photo upload failed');
            }
            externalPostId = fbData.post_id || fbData.id;
          } else {
            // Text status or fallback
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
              throw new Error(fbData.error?.message || 'Facebook post failed');
            }
            externalPostId = fbData.id;
          }
        }
        // -----------------------------------------------------------------
        // 3. YOUTUBE (Direct Resumable Stream)
        // -----------------------------------------------------------------
        else if (account.platform === 'YouTube') {
          if (!videoBuffer || !isVideo) {
            throw new Error('YouTube publishing requires a video file.');
          }

          const ytInitRes = await fetch(
            'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Upload-Content-Type': 'video/*',
              },
              body: JSON.stringify({
                snippet: {
                  title: title || 'Untitled Video',
                  description: `${caption ? caption + '\n\n' : ''}${description}`.trim(),
                  tags: tags.length > 0 ? tags : ['PublishingFlow'],
                  categoryId: '22',
                },
                status: {
                  privacyStatus: 'public',
                  selfDeclaredMadeForKids: false,
                },
              }),
            }
          );

          if (!ytInitRes.ok) {
            const ytErr = await ytInitRes.json().catch(() => ({}));
            throw new Error(ytErr.error?.message || 'YouTube upload session creation failed');
          }

          const resumableUrl = ytInitRes.headers.get('location');
          if (resumableUrl) {
            const ytUploadRes = await fetch(resumableUrl, {
              method: 'PUT',
              headers: {
                'Content-Type': 'video/*',
                'Content-Length': fileSizeBytes.toString(),
              },
              body: videoBuffer as unknown as BodyInit,
            });
            const ytData = await ytUploadRes.json().catch(() => ({}));
            externalPostId = ytData.id || resumableUrl;
          }
        }

        // Record Post metadata into Supabase Database (ZERO storage bytes used!)
        const isScheduled = Boolean(scheduleTimeSeconds);
        const { data: postRecord } = await supabase
          .from('posts')
          .insert({
            account_id: account.id,
            client_name: account.client_name,
            platform: account.platform,
            title: title.trim(),
            caption: caption.trim(),
            description: description.trim(),
            media_type: isVideo ? 'video' : 'image',
            media_name: file?.name || 'direct_upload',
            media_url: mediaUrlParam || null, // No Supabase storage file!
            status: isScheduled ? 'scheduled' : 'posted',
            published_at: isScheduled ? null : new Date().toISOString(),
            scheduled_at: scheduledAtIso,
            external_post_id: externalPostId,
          })
          .select('id')
          .single();

        await logAudit({
          action: isScheduled ? 'POST_SCHEDULED_DIRECT' : 'POST_PUBLISHED_DIRECT',
          entityType: 'post',
          entityId: postRecord?.id || externalPostId,
          clientName: account.client_name,
          platform: account.platform,
          status: 'success',
          details: { externalPostId, zeroDiskStorage: true, zeroSupabaseStorage: true },
        });

        results.push({
          accountId: account.id,
          platform: account.platform,
          clientName: account.client_name,
          success: true,
          externalPostId,
          scheduledAt: scheduledAtIso,
        });
      } catch (postErr: any) {
        console.error(`[Direct Upload Error] ${account.platform}:`, postErr);
        results.push({
          accountId: account.id,
          platform: account.platform,
          clientName: account.client_name,
          success: false,
          scheduledAt: scheduledAtIso,
          error: postErr.message || 'Direct upload failed',
        });
      }
    }
  }

    // Instant cleanup of temporary transit file: zero permanent storage in Supabase!
    // NOTE: If post is scheduled for future publishing, preserve transit file until scheduled worker executes!
    const anyScheduled = targetSlots.some((s) => s.seconds !== null);
    const tempStoragePath = (formData.get('tempStoragePath') as string) || '';
    if (tempStoragePath && !anyScheduled) {
      try {
        await supabase.storage.from('media').remove([tempStoragePath]);
        console.log(`[Zero Storage Cleanup]: Successfully purged ${tempStoragePath}`);
      } catch (cleanErr) {
        console.warn('Storage purge warning:', cleanErr);
      }
    }

    const allSuccessful = results.length > 0 && results.every((r) => r.success);

    return NextResponse.json({
      success: allSuccessful,
      results,
      message: allSuccessful
        ? 'Direct upload and publish succeeded! (0 MB Supabase / Server storage used)'
        : 'Some or all uploads had errors.',
    });
  } catch (err: any) {
    console.error('[Direct Publish Route Exception]:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
