import { getServerRules, incrementServerRuleTrigger, hasRepliedToComment, markCommentReplied } from './autoReplyStore';
import { logAudit } from './auditLogger';

export interface CommentEvent {
  commentId: string;
  commentText: string;
  fromUser?: string;
  fromId?: string;
  platform: 'Instagram' | 'Facebook';
  pageIdOrIgId: string;
  accessToken: string;
  mediaId?: string;
  permalink?: string;
}

export interface AutoReplyExecutionResult {
  triggered: boolean;
  ruleMatched?: string;
  keyword?: string;
  publicReplySuccess?: boolean;
  publicReplyError?: string;
  dmSuccess?: boolean;
  dmError?: string;
  skipReason?: string;
}

const inFlightCommentLocks = new Set<string>();

/**
 * Execute Auto Reply logic for an incoming comment on Facebook or Instagram
 */
export async function processCommentForAutoReply(
  event: CommentEvent
): Promise<AutoReplyExecutionResult> {
  const {
    commentId,
    commentText,
    fromUser,
    fromId,
    platform,
    pageIdOrIgId,
    accessToken,
    mediaId,
  } = event;

  if (!commentId || !commentText) {
    return { triggered: false, skipReason: 'Missing comment ID or text' };
  }

  // 1. Ignore comments from the page/account itself to prevent self-reply loops
  if (fromId && (fromId === pageIdOrIgId || fromUser === 'publishingflow' || fromUser === 'th_rachit_chauhan')) {
    return { triggered: false, skipReason: 'Ignoring comment from page/account itself' };
  }

  // 2. In-flight concurrency lock: reject if currently being processed in parallel
  if (inFlightCommentLocks.has(commentId)) {
    console.log(`[Auto Reply Engine] Blocked duplicate concurrent execution for comment ${commentId}`);
    return { triggered: false, skipReason: 'Concurrent execution locked' };
  }

  // 3. Check if already replied (durable Supabase audit log check)
  if (await hasRepliedToComment(commentId)) {
    return { triggered: false, skipReason: 'Already replied to this comment' };
  }

  // 4. Load active rules (synchronized from Supabase Auth)
  const allRules = await getServerRules();
  const activeRules = allRules.filter(
    r => r.isActive && (r.platform === 'All' || r.platform.toLowerCase() === platform.toLowerCase())
  );

  if (activeRules.length === 0) {
    return { triggered: false, skipReason: 'No active rules for platform' };
  }

  // 5. Find matching rule
  const cleanComment = commentText.trim().toLowerCase();
  const matchedRule = activeRules.find(r => {
    // If rule is locked to a specific post/video, ensure mediaId matches
    if (r.targetPostId && r.targetPostId !== 'all' && mediaId && r.targetPostId !== mediaId) {
      return false;
    }
    if (r.keyword === '*') return true;
    const cleanKw = r.keyword.trim().toLowerCase();
    return cleanComment.includes(cleanKw);
  });

  if (!matchedRule) {
    return { triggered: false, skipReason: `No keyword match for "${commentText}"` };
  }

  // ATOMIC LOCK CLAIM:
  // Immediately lock this comment in memory AND record it so no concurrent worker can proceed!
  inFlightCommentLocks.add(commentId);
  markCommentReplied({
    commentId,
    platform,
    ruleId: matchedRule.id,
    commentText,
    repliedAt: new Date().toISOString(),
  });

  // Write immediate audit log to Supabase so other serverless containers are blocked immediately
  await logAudit({
    action: 'AUTO_REPLY_TRIGGERED',
    entityType: 'post',
    entityId: commentId,
    clientName: fromUser || 'User',
    platform,
    status: 'success',
    details: {
      ruleKeyword: matchedRule.keyword,
      commentText,
    },
  });

  console.log(`[Auto Reply Engine] Processing single reply for "${matchedRule.keyword}" on comment "${commentText}" from ${fromUser || fromId}`);

  let publicReplySuccess = false;
  let publicReplyError: string | undefined;
  let dmSuccess = false;
  let dmError: string | undefined;

    // 5.5 Follower Gate Check (if enabled on rule)
    let isFollower = true;
    const followerGateActive = Boolean(matchedRule.requireFollower);

    if (followerGateActive) {
      isFollower = false; // Default to false until verified
      if (fromId) {
        try {
          if (platform === 'Instagram') {
            const checkRes = await fetch(
              `https://graph.facebook.com/v22.0/${fromId}?fields=is_user_follow_business&access_token=${accessToken}`
            );
            const checkData = await checkRes.json();
            if (typeof checkData.is_user_follow_business === 'boolean') {
              isFollower = checkData.is_user_follow_business;
            }
          }
        } catch (err) {
          console.warn('[Auto Reply Engine] Follower check note:', err);
        }
      }
    }

    // Determine final message content based on follower gating
    let finalDmMessage = matchedRule.dmMessage;
    // Public reply always goes to everyone who comments (follower or unfollower)
    const finalPublicReply = (followerGateActive && !isFollower && matchedRule.nonFollowerCommentReply)
      ? matchedRule.nonFollowerCommentReply
      : matchedRule.commentReply;

    if (followerGateActive) {
      if (isFollower) {
        // Follower: Send main DM with link
        finalDmMessage = matchedRule.followerDmMessage || matchedRule.dmMessage;
        if (matchedRule.followerOnlyLink && !finalDmMessage.includes(matchedRule.followerOnlyLink)) {
          finalDmMessage += `\n\n🔗 Your exclusive link: ${matchedRule.followerOnlyLink}`;
        }
      } else {
        // Unfollower / Not following: Send follow-prompt DM
        finalDmMessage = matchedRule.nonFollowerDmMessage ||
          `Hey ${fromUser ? `@${fromUser}` : 'there'}! 👋\n\nYe link lene ke liye pehle hamare account ko follow karein! 🎁 Follow karte hi yahan reply karein ya dobara comment karein, link turant mil jayega 🚀`;
      }
    }

    // 6. Send Public Comment Reply (Sabhi ko jayega, chahe follower ho ya unfollower)
    if (finalPublicReply) {
      try {
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
            message: finalPublicReply,
            access_token: accessToken,
          }),
        });

        const data = await res.json();
        if (res.ok && data.id) {
          publicReplySuccess = true;
          console.log(`[Auto Reply Engine] Public reply posted successfully: ${data.id}`);
        } else {
          publicReplyError = data.error?.message || 'Failed to post public reply';
          console.warn(`[Auto Reply Engine] Public reply error:`, data);
        }
      } catch (err: any) {
        publicReplyError = err.message;
        console.warn(`[Auto Reply Engine] Public reply fetch error:`, err);
      }
    }

    // 7. Send Private DM Reply
    if (finalDmMessage) {
      try {
        const dmEndpoint = 'https://graph.facebook.com/v22.0/me/messages';
        const res = await fetch(dmEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { comment_id: commentId },
            message: { text: finalDmMessage },
            access_token: accessToken,
          }),
        });

        const data = await res.json();
        if (res.ok && (data.message_id || data.recipient_id)) {
          dmSuccess = true;
          console.log(`[Auto Reply Engine] Private DM reply sent successfully:`, data);
        } else {
          dmError = data.error?.message || 'Failed to send private DM';
          console.warn(`[Auto Reply Engine] Private DM error:`, data);
        }
      } catch (err: any) {
        dmError = err.message;
        console.warn(`[Auto Reply Engine] Private DM fetch error:`, err);
      }
    }

    // Increment trigger count
    await incrementServerRuleTrigger(matchedRule.id);

    return {
      triggered: true,
      ruleMatched: matchedRule.id,
      keyword: matchedRule.keyword,
      publicReplySuccess,
      publicReplyError,
      dmSuccess,
      dmError,
    };
  } finally {
    // Keep in lock set for 15 seconds to prevent trailing duplicate calls
    setTimeout(() => {
      inFlightCommentLocks.delete(commentId);
    }, 15000);
  }
}
