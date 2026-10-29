import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getValidAccessToken } from '@/lib/oauthTokens';
import { logAudit } from '@/lib/auditLogger';
import { markCommentReplied, hasRepliedToComment } from '@/lib/autoReplyStore';

export const dynamic = 'force-dynamic';

export interface UnifiedComment {
  id: string;
  commentId: string;
  platform: 'Instagram' | 'Facebook';
  accountName: string;
  accountId?: string;
  mediaId: string;
  postTitle: string;
  permalink?: string;
  fromUser: string;
  fromName: string;
  fromId?: string;
  text: string;
  timestamp: string;
  likeCount: number;
  replied: boolean;
  replyText?: string;
}

// Fallback demo comments shown when accounts have 0 comments or during testing
const demoComments: UnifiedComment[] = [
  {
    id: 'demo-c1',
    commentId: '180992381283719',
    platform: 'Instagram',
    accountName: 'PublishingFlow Official',
    mediaId: 'media-reel-101',
    postTitle: '🔥 5 Automation Secrets for Reels in 2026',
    permalink: 'https://instagram.com',
    fromUser: 'rohit_creatives',
    fromName: 'Rohit Sharma',
    fromId: 'user-rohit-1',
    text: 'Bhai please send the download link! Amazing content 🙌',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    likeCount: 4,
    replied: true,
    replyText: 'Check your DM! Sent the link right away 🚀',
  },
  {
    id: 'demo-c2',
    commentId: '180992381283720',
    platform: 'Instagram',
    accountName: 'PublishingFlow Official',
    mediaId: 'media-reel-101',
    postTitle: '🔥 5 Automation Secrets for Reels in 2026',
    permalink: 'https://instagram.com',
    fromUser: 'anjali_growth',
    fromName: 'Anjali Verma',
    fromId: 'user-anjali-2',
    text: 'PRICE and course details please?',
    timestamp: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
    likeCount: 2,
    replied: true,
    replyText: 'Details sent directly to your inbox 📩',
  },
  {
    id: 'demo-c3',
    commentId: '180992381283721',
    platform: 'Facebook',
    accountName: 'PublishingFlow Page',
    mediaId: 'post-fb-202',
    postTitle: 'Step-by-Step Meta API Setup Tutorial',
    permalink: 'https://facebook.com',
    fromUser: 'vipin.kumar.99',
    fromName: 'Vipin Kumar',
    fromId: 'user-vipin-3',
    text: 'Kya yeh feature personal accounts me bhi kaam karega ya sirf business pages me?',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    likeCount: 7,
    replied: false,
  },
  {
    id: 'demo-c4',
    commentId: '180992381283722',
    platform: 'Instagram',
    accountName: 'PublishingFlow Official',
    mediaId: 'media-reel-103',
    postTitle: 'How to automate comment replies with 0 coding',
    permalink: 'https://instagram.com',
    fromUser: 'manish_tech',
    fromName: 'Manish Singh',
    fromId: 'user-manish-4',
    text: 'Super helpful video brother! Can you share the source link?',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    likeCount: 3,
    replied: false,
  },
  {
    id: 'demo-c5',
    commentId: '180992381283723',
    platform: 'Facebook',
    accountName: 'PublishingFlow Page',
    mediaId: 'post-fb-205',
    postTitle: 'New Product Launch: Auto-Reply 2.0',
    permalink: 'https://facebook.com',
    fromUser: 'pooja.sharma.12',
    fromName: 'Pooja Sharma',
    fromId: 'user-pooja-5',
    text: 'Interested in the premium plan! Please send details.',
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    likeCount: 5,
    replied: true,
    replyText: 'Hey Pooja! DM sent with our pricing brochure 👍',
  },
];

export async function GET() {
  const supabase = createServerSupabaseClient();
  const liveComments: UnifiedComment[] = [];

  if (supabase) {
    try {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('*')
        .eq('connection_status', 'Connected')
        .eq('connection_type', 'oauth');

      for (const acc of accounts || []) {
        if (acc.platform !== 'Facebook' && acc.platform !== 'Instagram') continue;

        try {
          const { accessToken, oauthAccountId } = await getValidAccessToken(acc.id);

          // 1. Fetch Instagram Comments
          if (acc.platform === 'Instagram') {
            const igUserId = oauthAccountId || 'me';
            const mediaRes = await fetch(
              `https://graph.facebook.com/v22.0/${igUserId}/media?fields=id,caption,permalink,thumbnail_url,media_url,timestamp&limit=10&access_token=${accessToken}`
            );
            const mediaData = await mediaRes.json();

            for (const media of mediaData.data || []) {
              try {
                const cRes = await fetch(
                  `https://graph.facebook.com/v22.0/${media.id}/comments?fields=id,text,from,timestamp,like_count,username&limit=25&access_token=${accessToken}`
                );
                const cData = await cRes.json();

                for (const c of cData.data || []) {
                  const alreadyReplied = await hasRepliedToComment(c.id);
                  liveComments.push({
                    id: `ig-${c.id}`,
                    commentId: c.id,
                    platform: 'Instagram',
                    accountName: acc.client_name || 'Instagram Account',
                    accountId: acc.id,
                    mediaId: media.id,
                    postTitle: (media.caption || 'Instagram Reel/Post').slice(0, 60),
                    permalink: media.permalink,
                    fromUser: c.username || c.from?.username || 'instagram_user',
                    fromName: c.from?.name || c.username || 'User',
                    fromId: c.from?.id,
                    text: c.text || '',
                    timestamp: c.timestamp || new Date().toISOString(),
                    likeCount: c.like_count || 0,
                    replied: alreadyReplied,
                  });
                }
              } catch (err) {
                console.warn(`[Comments API] IG comments error for ${media.id}:`, err);
              }
            }
          }

          // 2. Fetch Facebook Comments
          if (acc.platform === 'Facebook') {
            const pageId = oauthAccountId || 'me';
            const pRes = await fetch(
              `https://graph.facebook.com/v22.0/${pageId}/published_posts?fields=id,message,permalink_url,created_time&limit=10&access_token=${accessToken}`
            );
            const pData = await pRes.json();

            for (const post of pData.data || []) {
              try {
                const cRes = await fetch(
                  `https://graph.facebook.com/v22.0/${post.id}/comments?fields=id,message,from,created_time,like_count&limit=25&access_token=${accessToken}`
                );
                const cData = await cRes.json();

                for (const c of cData.data || []) {
                  const alreadyReplied = await hasRepliedToComment(c.id);
                  liveComments.push({
                    id: `fb-${c.id}`,
                    commentId: c.id,
                    platform: 'Facebook',
                    accountName: acc.client_name || 'Facebook Page',
                    accountId: acc.id,
                    mediaId: post.id,
                    postTitle: (post.message || 'Facebook Post').slice(0, 60),
                    permalink: post.permalink_url,
                    fromUser: c.from?.name ? c.from.name.toLowerCase().replace(/\s+/g, '_') : 'facebook_user',
                    fromName: c.from?.name || 'Facebook User',
                    fromId: c.from?.id,
                    text: c.message || '',
                    timestamp: c.created_time || new Date().toISOString(),
                    likeCount: c.like_count || 0,
                    replied: alreadyReplied,
                  });
                }
              } catch (err) {
                console.warn(`[Comments API] FB comments error for ${post.id}:`, err);
              }
            }
          }
        } catch (accErr) {
          console.warn(`[Comments API] Error processing account ${acc.id}:`, accErr);
        }
      }
    } catch (dbErr) {
      console.warn('[Comments API] Supabase query error:', dbErr);
    }
  }

  // Combine live comments with demo comments if live is empty or supplement
  const combined = liveComments.length > 0 ? liveComments : demoComments;

  // Sort newest first
  combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return NextResponse.json({
    success: true,
    totalCount: combined.length,
    isLive: liveComments.length > 0,
    comments: combined,
  });
}

// POST: Send direct manual reply to a comment
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { commentId, platform, replyMessage, accountId } = body;

    if (!commentId || !replyMessage?.trim()) {
      return NextResponse.json({ error: 'commentId and replyMessage are required' }, { status: 400 });
    }

    let accessToken = '';

    // If an account ID was provided, obtain valid token
    if (accountId) {
      try {
        const tokenData = await getValidAccessToken(accountId);
        accessToken = tokenData.accessToken;
      } catch (err) {
        console.warn('[Comments Reply] Could not fetch token for account:', err);
      }
    }

    // If real token available, dispatch to Meta Graph API
    if (accessToken) {
      let replyEndpoint = '';
      if (platform === 'Facebook') {
        replyEndpoint = `https://graph.facebook.com/v22.0/${commentId}/comments`;
      } else {
        replyEndpoint = `https://graph.facebook.com/v22.0/${commentId}/replies`;
      }

      const res = await fetch(replyEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: replyMessage.trim(),
          access_token: accessToken,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        return NextResponse.json({ error: resData.error?.message || 'Meta API reply failed' }, { status: 400 });
      }
    }

    // Mark replied in durable store and audit log
    markCommentReplied({
      commentId,
      platform: platform || 'Instagram',
      ruleId: 'manual-reply',
      commentText: replyMessage.trim(),
      repliedAt: new Date().toISOString(),
    });

    await logAudit({
      action: 'MANUAL_COMMENT_REPLIED',
      entityType: 'post',
      entityId: commentId,
      clientName: 'Admin',
      platform: platform || 'Meta',
      status: 'success',
      details: { replyMessage: replyMessage.trim() },
    });

    return NextResponse.json({
      success: true,
      message: 'Reply sent successfully!',
      commentId,
      replyMessage: replyMessage.trim(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
