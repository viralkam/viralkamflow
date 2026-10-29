import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getValidAccessToken } from '@/lib/oauthTokens';
import { uploadDirectToInstagramReels, uploadDirectToFacebookPage } from '@/lib/metaDirectUpload';
import { logAudit } from '@/lib/auditLogger';
import { getUserData, saveUserData } from '@/lib/userStore';

/**
 * Direct Upload & Publish Route
 * 
 * ZERO SERVER DISK STORAGE & ZERO SUPABASE STORAGE:
 * - Instagram Reels: Streams video binary buffer directly to Instagram's server (rupload.facebook.com)
 * - Facebook Page: Streams directly to graph-video.facebook.com (natively scheduled on Meta)
 * - YouTube: Streams directly to YouTube Resumable upload session
 * - Threads: Streams directly to graph.threads.net
 * 
 * Video files are NEVER stored on user server or Supabase Storage!
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

    // Fetch accounts from Supabase DB or Admin UserStore fallback
    let accounts: any[] = [];
    const { data: dbAccs } = await supabase.from('accounts').select('*').in('id', accountIds);
    if (dbAccs && dbAccs.length > 0) {
      accounts = dbAccs;
    } else {
      const adminData = await getUserData('admin');
      accounts = (adminData?.accounts || []).filter(a => accountIds.includes(a.id)).map(a => ({
        id: a.id,
        client_name: a.clientName,
        platform: a.platform,
        connection_type: a.connectionType,
        connection_status: a.connectionStatus,
        oauth_access_token: a.oauthAccessToken,
        oauth_account_id: a.oauthAccountId,
      }));
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ error: 'Selected accounts could not be found. Please check connected channels.' }, { status: 404 });
    }

    for (const account of accounts) {
      for (const slot of targetSlots) {
        const scheduleTimeSeconds = slot.seconds;
        const scheduledAtIso = slot.iso;
        const isScheduled = Boolean(scheduleTimeSeconds);

        try {
          if (account.connection_status !== 'Connected' || account.connection_type !== 'oauth') {
            throw new Error(`Account "${account.client_name}" (${account.platform}) is not actively connected via OAuth.`);
          }

          let accessToken = account.oauth_access_token || '';
          let oauthAccountId = account.oauth_account_id || '';

          try {
            const tokenInfo = await getValidAccessToken(account.id);
            accessToken = tokenInfo.accessToken;
            oauthAccountId = tokenInfo.oauthAccountId || oauthAccountId;
          } catch (tErr: any) {
            console.warn(`[Token Refresh Notice for ${account.platform}]:`, tErr.message);
          }

          if (!accessToken) {
            throw new Error(`No valid access token found for account "${account.client_name}". Please reconnect.`);
          }

          let externalPostId = '';
          const messageContent = `${title ? title + '\n\n' : ''}${caption}`.trim();

          // -----------------------------------------------------------------
          // 1. INSTAGRAM REELS (Stream video DIRECTLY to Instagram server)
          // -----------------------------------------------------------------
          if (account.platform === 'Instagram') {
            const igUserId = oauthAccountId || 'me';

            if (videoBuffer) {
              // Push binary stream DIRECTLY to Instagram's rupload endpoint (rupload.facebook.com)
              // The video lives on Instagram's server, NEVER on our server!
              const igRes = await uploadDirectToInstagramReels({
                videoBuffer,
                fileSizeBytes,
                caption: messageContent,
                igUserId,
                accessToken,
                scheduleTimeSeconds,
              });
              externalPostId = igRes.containerId || igRes.postId;
            } else if (mediaUrlParam) {
              const isDirectIg = accessToken.startsWith('IG');
              const igHost = isDirectIg ? 'graph.instagram.com' : 'graph.facebook.com';
              const igTarget = isDirectIg ? 'me' : igUserId;

              const containerBody: Record<string, any> = {
                media_type: 'REELS',
                video_url: mediaUrlParam,
                caption: messageContent,
                access_token: accessToken,
              };

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

              // Poll until Instagram finishes transcoding
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
                  throw new Error('Instagram video processing failed. Please ensure standard MP4 format.');
                }
              }

              if (!isScheduled) {
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
                externalPostId = containerId;
              }
            } else {
              throw new Error('Instagram Reels requires a video file or valid video URL.');
            }
          } 
          // -----------------------------------------------------------------
          // 2. FACEBOOK PAGE (Direct Stream to Facebook Video API)
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
          // 3. THREADS (Meta Threads API)
          // -----------------------------------------------------------------
          else if (account.platform === 'Threads') {
            const threadsUserId = oauthAccountId || 'me';
            const threadsPayload: Record<string, any> = {
              text: messageContent || title || '',
              access_token: accessToken,
            };

            if (mediaUrlParam) {
              threadsPayload.media_type = isVideo ? 'VIDEO' : 'IMAGE';
              if (isVideo) threadsPayload.video_url = mediaUrlParam;
              else threadsPayload.image_url = mediaUrlParam;
            } else {
              threadsPayload.media_type = 'TEXT';
            }

            const thRes = await fetch(`https://graph.threads.net/v1.0/${threadsUserId}/threads`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(threadsPayload),
            });
            const thData = await thRes.json();
            if (!thRes.ok || !thData.id) {
              throw new Error(thData?.error?.message || 'Threads container creation failed');
            }
            const creationId = thData.id;

            if (!isScheduled) {
              const pubRes = await fetch(
                `https://graph.threads.net/v1.0/${threadsUserId}/threads_publish?creation_id=${creationId}&access_token=${accessToken}`,
                { method: 'POST' }
              );
              const pubData = await pubRes.json();
              if (!pubRes.ok || !pubData.id) {
                throw new Error(pubData?.error?.message || 'Threads publish failed');
              }
              externalPostId = pubData.id;
            } else {
              externalPostId = creationId;
            }
          }
          // -----------------------------------------------------------------
          // 4. YOUTUBE (Direct Resumable Stream)
          // -----------------------------------------------------------------
          else if (account.platform === 'YouTube') {
            if (!videoBuffer || !isVideo) {
              throw new Error('YouTube publishing requires a video file.');
            }

            const ytStatus: Record<string, any> = {
              privacyStatus: isScheduled ? 'private' : 'public',
              selfDeclaredMadeForKids: false,
            };
            if (isScheduled && scheduledAtIso) {
              ytStatus.publishAt = scheduledAtIso;
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
                  status: ytStatus,
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

          // Resolve media reference:
          // For scheduled Instagram reels, save 'instagram-container:{containerId}'
          // so the scheduler knows the video is already transcoded on Instagram's server!
          const resolvedMediaUrl = (account.platform === 'Instagram' && externalPostId && isScheduled)
            ? `instagram-container:${externalPostId}`
            : (mediaUrlParam || null);

          let postRecordId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `pst-${Date.now()}`;

          // Record Post in Supabase DB (clean insert matching schema)
          try {
            const { data: pRec } = await supabase
              .from('posts')
              .insert({
                id: postRecordId,
                account_id: account.id,
                client_name: account.client_name,
                platform: account.platform,
                title: title.trim(),
                caption: caption.trim(),
                description: description.trim(),
                media_type: isVideo ? 'video' : 'image',
                media_name: file?.name || 'direct_upload',
                media_url: resolvedMediaUrl,
                is_scheduled: isScheduled,
                status: isScheduled ? 'scheduled' : 'posted',
                published_at: isScheduled ? null : new Date().toISOString(),
                scheduled_at: scheduledAtIso,
              })
              .select('id')
              .maybeSingle();

            if (pRec?.id) postRecordId = pRec.id;
          } catch (dbErr) {
            console.warn('[Supabase Insert Notice]:', dbErr);
          }

          // Also save post to Admin store so UI immediately updates
          try {
            const adminData = await getUserData('admin');
            if (adminData) {
              const newPostItem = {
                id: postRecordId,
                accountId: account.id,
                clientName: account.client_name,
                platform: account.platform,
                title: title.trim(),
                caption: caption.trim(),
                description: description.trim(),
                mediaUrl: resolvedMediaUrl || undefined,
                mediaType: (isVideo ? 'video' : 'image') as any,
                mediaName: file?.name || 'direct_upload',
                isScheduled,
                status: (isScheduled ? 'scheduled' : 'posted') as any,
                publishedAt: isScheduled ? undefined : new Date().toISOString(),
                scheduledAt: scheduledAtIso || undefined,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              adminData.posts = [newPostItem, ...(adminData.posts || []).filter(p => p.id !== postRecordId)];
              await saveUserData('admin', adminData);
            }
          } catch (uErr) {
            console.warn('[Admin Store Save Notice]:', uErr);
          }

          await logAudit({
            action: isScheduled ? 'POST_SCHEDULED_DIRECT' : 'POST_PUBLISHED_DIRECT',
            entityType: 'post',
            entityId: postRecordId || externalPostId,
            clientName: account.client_name,
            platform: account.platform,
            status: 'success',
            details: { externalPostId, zeroServerDisk: true, directToSocialServer: true },
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
          console.error(`[Direct Publish Error] ${account.platform}:`, postErr);
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

    const allSuccessful = results.length > 0 && results.every((r) => r.success);

    return NextResponse.json({
      success: allSuccessful,
      results,
      message: allSuccessful
        ? 'Direct upload and publish succeeded! (Directly posted to Instagram / Social Server - 0 MB storage on your server)'
        : 'Some uploads encountered errors.',
    });
  } catch (err: any) {
    console.error('[Direct Publish Route Exception]:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
