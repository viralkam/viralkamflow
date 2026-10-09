import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getValidAccessToken } from '@/lib/oauthTokens';
import { getUserData } from '@/lib/userStore';

export interface MetaContentItem {
  id: string;
  platform: 'Instagram' | 'Facebook';
  caption: string;
  mediaType: 'video' | 'image' | 'text';
  mediaUrl?: string;
  thumbnailUrl?: string;
  permalink?: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  viewCount?: number;
  publishedAt: string;
  accountName: string;
}

/**
 * Fetch Live Content Feed from Meta Graph API
 * Supports both Instagram Professional accounts and Facebook Pages
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const requestedPlatform = searchParams.get('platform') || 'all';
  const sessionUserId = req.cookies.get('pf_session_user_id')?.value || searchParams.get('userId');

  const liveItems: MetaContentItem[] = [];

  if (!sessionUserId) {
    return NextResponse.json({ success: true, count: 0, items: [] });
  }

  const userData = await getUserData(sessionUserId);
  if (!userData || !userData.accounts || userData.accounts.length === 0) {
    return NextResponse.json({ success: true, count: 0, items: [] });
  }

  const userAccounts = userData.accounts.filter(
    a => a.connectionStatus === 'Connected' && a.connectionType === 'oauth'
  );

  for (const acc of userAccounts) {
    try {
      let accessToken = acc.oauthAccessToken;
      let oauthAccountId = acc.oauthAccountId;

      if (!accessToken) {
        try {
          const res = await getValidAccessToken(acc.id);
          accessToken = res.accessToken;
          oauthAccountId = res.oauthAccountId || oauthAccountId;
        } catch {}
      }

      if (!accessToken) continue;

          // 1. Fetch Instagram Live Media
          if ((requestedPlatform === 'all' || requestedPlatform === 'instagram') && acc.platform === 'Instagram') {
            const igUserId = oauthAccountId || 'me';
            let igItems: any[] = [];

            // Direct Instagram Login tokens start with IGAA/IG and query graph.instagram.com
            const isDirectIg = accessToken.startsWith('IG');
            const primaryHost = isDirectIg ? 'graph.instagram.com' : 'graph.facebook.com';
            const fallbackHost = isDirectIg ? 'graph.facebook.com' : 'graph.instagram.com';

            try {
              const primaryUrl = `https://${primaryHost}/v22.0/${isDirectIg ? 'me' : igUserId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=25&access_token=${accessToken}`;
              const primaryRes = await fetch(primaryUrl);
              const primaryData = await primaryRes.json();
              if (primaryData.data && Array.isArray(primaryData.data)) {
                igItems = primaryData.data;
              }
            } catch (err) {
              console.warn('[Feed] Primary Instagram fetch failed:', err);
            }

            if (igItems.length === 0) {
              try {
                const fallbackUrl = `https://${fallbackHost}/v22.0/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=25&access_token=${accessToken}`;
                const fallbackRes = await fetch(fallbackUrl);
                const fallbackData = await fallbackRes.json();
                if (fallbackData.data && Array.isArray(fallbackData.data)) {
                  igItems = fallbackData.data;
                }
              } catch (err) {
                console.warn('[Feed] Fallback Instagram fetch failed:', err);
              }
            }

            for (const item of igItems) {
              liveItems.push({
                id: item.id,
                platform: 'Instagram',
                caption: item.caption || '',
                mediaType: item.media_type === 'VIDEO' ? 'video' : 'image',
                mediaUrl: item.media_url || item.thumbnail_url,
                thumbnailUrl: item.thumbnail_url || item.media_url,
                permalink: item.permalink,
                likeCount: item.like_count || 0,
                commentCount: item.comments_count || 0,
                shareCount: 0,
                viewCount: 0,
                publishedAt: item.timestamp || new Date().toISOString(),
                accountName: acc.clientName || (acc as any).client_name || 'Instagram',
              });
            }
          }

          // 2. Fetch Facebook Page Live Published Posts & Videos
          if ((requestedPlatform === 'all' || requestedPlatform === 'facebook') && acc.platform === 'Facebook') {
            const pageId = oauthAccountId || 'me';

            // Fetch photo likes & comments map from uploaded photos
            const photoStatsMap = new Map<string, { likes: number; comments: number }>();
            try {
              const photoRes = await fetch(
                `https://graph.facebook.com/v22.0/${pageId}/photos/uploaded?fields=id,name,likes.summary(true),comments.limit(0).summary(true)&limit=25&access_token=${accessToken}`
              );
              const photoData = await photoRes.json();
              if (photoData.data && Array.isArray(photoData.data)) {
                for (const ph of photoData.data) {
                  if (ph.name) {
                    photoStatsMap.set(ph.name.trim(), {
                      likes: ph.likes?.summary?.total_count || 0,
                      comments: ph.comments?.summary?.total_count || 0,
                    });
                  }
                }
              }
            } catch {}

            // A. Fetch Published Posts (Photos, status updates, links)
            try {
              const fbRes = await fetch(
                `https://graph.facebook.com/v22.0/${pageId}/published_posts?fields=id,message,created_time,full_picture,attachments{media,type,url},permalink_url,shares&limit=25&access_token=${accessToken}`
              );
              const fbData = await fbRes.json();

              if (fbData.data && Array.isArray(fbData.data)) {
                for (const item of fbData.data) {
                  const mediaAttachment = item.attachments?.data?.[0];
                  const imgSrc = mediaAttachment?.media?.image?.src || item.full_picture || undefined;
                  const isVid = mediaAttachment?.type?.includes('video');
                  const stats = photoStatsMap.get((item.message || '').trim()) || { likes: 0, comments: 0 };

                  liveItems.push({
                    id: item.id,
                    platform: 'Facebook',
                    caption: item.message || '',
                    mediaType: isVid ? 'video' : (imgSrc ? 'image' : 'text'),
                    mediaUrl: imgSrc,
                    thumbnailUrl: imgSrc,
                    permalink: item.permalink_url,
                    likeCount: stats.likes,
                    commentCount: stats.comments,
                    shareCount: item.shares?.count || 0,
                    viewCount: 0,
                    publishedAt: item.created_time || new Date().toISOString(),
                    accountName: acc.clientName || (acc as any).client_name || 'Facebook',
                  });
                }
              }
            } catch (postErr) {
              console.warn('[Meta Feed] Failed fetching FB published_posts:', postErr);
            }

            // B. Fetch Page Videos & Reels (Includes live view count, likes count, and comments count)
            try {
              const vidRes = await fetch(
                `https://graph.facebook.com/v22.0/${pageId}/videos?fields=id,description,picture,source,permalink_url,views,likes.summary(true),comments.limit(0).summary(true),created_time&limit=25&access_token=${accessToken}`
              );
              const vidData = await vidRes.json();

              if (vidData.data && Array.isArray(vidData.data)) {
                for (const vid of vidData.data) {
                  // Check if already included in published_posts
                  const existingIdx = liveItems.findIndex(i => i.id === vid.id || (i.caption && i.caption === vid.description));
                  const permalink = vid.permalink_url?.startsWith('http')
                    ? vid.permalink_url
                    : (vid.permalink_url ? `https://www.facebook.com${vid.permalink_url}` : undefined);
                  const likes = vid.likes?.summary?.total_count || 0;
                  const comments = vid.comments?.summary?.total_count || 0;
                  const views = vid.views || 0;

                  if (existingIdx !== -1) {
                    // Enrich existing item with video views, likes, and comments!
                    liveItems[existingIdx].likeCount = likes;
                    liveItems[existingIdx].commentCount = comments;
                    liveItems[existingIdx].viewCount = views;
                    liveItems[existingIdx].mediaType = 'video';
                    if (vid.source) liveItems[existingIdx].mediaUrl = vid.source;
                  } else {
                    liveItems.push({
                      id: vid.id,
                      platform: 'Facebook',
                      caption: vid.description || '',
                      mediaType: 'video',
                      mediaUrl: vid.source || vid.picture,
                      thumbnailUrl: vid.picture,
                      permalink,
                      likeCount: likes,
                      commentCount: comments,
                      shareCount: 0,
                      viewCount: views,
                      publishedAt: vid.created_time || new Date().toISOString(),
                      accountName: acc.clientName || (acc as any).client_name || 'Facebook',
                    });
                  }
                }
              }
            } catch (vidErr) {
              console.warn('[Meta Feed] Failed fetching FB videos:', vidErr);
            }
          }
        } catch (accErr) {
          console.warn(`[Meta Feed] Failed fetching for account:`, accErr);
        }
      }

  // Sort latest first
  liveItems.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return NextResponse.json({
    success: true,
    count: liveItems.length,
    items: liveItems,
  });
}
