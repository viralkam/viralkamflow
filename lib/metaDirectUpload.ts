/**
 * Direct Meta (Instagram Reels & Facebook Page) Upload Utility
 * 
 * ZERO SERVER DISK STORAGE & ZERO SUPABASE STORAGE:
 * - Instagram Reels: Meta Resumable Upload protocol (rupload.facebook.com)
 * - Facebook Page: Direct multipart stream (graph-video.facebook.com)
 * 
 * Works 100% in-memory with Buffer / Blob streams.
 */

export const META_GRAPH_VERSION = 'v22.0';

export interface InstagramDirectUploadParams {
  videoBuffer: Buffer | ArrayBuffer;
  fileSizeBytes: number;
  caption?: string;
  igUserId: string;
  accessToken: string;
  scheduleTimeSeconds?: number | null; // Optional Unix timestamp in seconds
}

export interface InstagramDirectUploadResult {
  success: boolean;
  postId: string;
  isScheduled: boolean;
  containerId?: string;
}

export interface FacebookDirectUploadParams {
  videoBuffer: Buffer | ArrayBuffer;
  fileName?: string;
  title?: string;
  description?: string;
  pageId: string;
  pageAccessToken: string;
  scheduleTimeSeconds?: number | null;
}

export interface FacebookDirectUploadResult {
  success: boolean;
  videoId: string;
  isScheduled: boolean;
}

/**
 * Direct Upload to Instagram Reels (Zero Disk Storage, Zero Supabase Storage)
 */
export async function uploadDirectToInstagramReels({
  videoBuffer,
  fileSizeBytes,
  caption = '',
  igUserId,
  accessToken,
  scheduleTimeSeconds = null,
}: InstagramDirectUploadParams): Promise<InstagramDirectUploadResult> {
  // Step 1: Initialize Resumable Media Container on Meta
  const containerBody: Record<string, any> = {
    media_type: 'REELS',
    upload_type: 'resumable',
    caption: caption,
    access_token: accessToken,
  };

  // NOTE: scheduled_publish_time is deliberately NOT passed to Instagram container.
  // Meta Instagram Graph API restricts native scheduled_publish_time to whitelisted Facebook Marketing Partners.
  // All standard scheduled Instagram posts are scheduled in the app database and published automatically by the background worker.

  const isDirectIg = accessToken.startsWith('IG');
  const igHost = isDirectIg ? 'graph.instagram.com' : 'graph.facebook.com';
  const igTarget = isDirectIg ? 'me' : igUserId;

  const initUrl = `https://${igHost}/${META_GRAPH_VERSION}/${igTarget}/media`;
  const initRes = await fetch(initUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(containerBody),
  });

  const initData = await initRes.json();
  if (!initRes.ok || !initData.uri || !initData.id) {
    handleMetaError(initData?.error || initData, 'Instagram Reels Container Initialization');
  }

  const uploadUrl = initData.uri; // e.g. https://rupload.facebook.com/ig-reels/...
  const containerId = initData.id;

  // Step 2: Push binary buffer directly to Meta's rupload endpoint (Zero Disk Touch)
  const binaryRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${accessToken}`,
      offset: '0',
      file_size: fileSizeBytes.toString(),
      'Content-Type': 'application/octet-stream',
    },
    body: videoBuffer as unknown as BodyInit,
  });

  const binaryData = await binaryRes.json().catch(() => ({}));
  if (binaryData.status !== 'success' && !binaryData.success && binaryRes.status >= 400) {
    throw new Error(`Meta rupload binary upload failed: ${JSON.stringify(binaryData)}`);
  }

  // Step 3: Wait for Meta video transcoding / processing (Poll status)
  let isReady = false;
  for (let i = 0; i < 20; i++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const statusRes = await fetch(
      `https://${igHost}/${META_GRAPH_VERSION}/${containerId}?fields=status_code,status&access_token=${accessToken}`
    );
    const statusData = await statusRes.json();

    if (statusData.status_code === 'FINISHED') {
      isReady = true;
      break;
    } else if (statusData.status_code === 'ERROR') {
      throw new Error(
        'Instagram Reel processing failed on Meta servers. Ensure video is standard MP4/MOV, 9:16 vertical ratio, and under 15 minutes.'
      );
    } else if (statusData.status_code === 'EXPIRED') {
      throw new Error('Meta media container expired before publishing.');
    }
  }

  if (!isReady && !scheduleTimeSeconds) {
    // Grace period wait if still transcoding
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }

  // Step 4: Publish Container (If not scheduled)
  if (scheduleTimeSeconds) {
    return {
      success: true,
      postId: containerId,
      isScheduled: true,
      containerId,
    };
  }

  const publishUrl = `https://${igHost}/${META_GRAPH_VERSION}/${igTarget}/media_publish`;
  const publishRes = await fetch(publishUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: accessToken,
    }),
  });

  const publishData = await publishRes.json();
  if (!publishRes.ok || !publishData.id) {
    handleMetaError(publishData?.error || publishData, 'Instagram Reels Publish');
  }

  return {
    success: true,
    postId: publishData.id,
    isScheduled: false,
    containerId,
  };
}

/**
 * Direct Upload to Facebook Page Video (Zero Disk Storage, Zero Supabase Storage)
 */
export async function uploadDirectToFacebookPage({
  videoBuffer,
  fileName = 'video.mp4',
  title = '',
  description = '',
  pageId,
  pageAccessToken,
  scheduleTimeSeconds = null,
}: FacebookDirectUploadParams): Promise<FacebookDirectUploadResult> {
  const blob = new Blob([videoBuffer as any], { type: 'video/mp4' });
  const formData = new FormData();
  formData.append('source', blob, fileName);

  if (title) formData.append('title', title);
  if (description) formData.append('description', description);
  formData.append('access_token', pageAccessToken);

  if (scheduleTimeSeconds) {
    formData.append('published', 'false');
    formData.append('scheduled_publish_time', scheduleTimeSeconds.toString());
  }

  const endpoint = `https://graph-video.facebook.com/${META_GRAPH_VERSION}/${pageId}/videos`;
  const res = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();
  if (!res.ok || !data.id) {
    handleMetaError(data?.error || data, 'Facebook Page Video Direct Upload');
  }

  return {
    success: true,
    videoId: data.id,
    isScheduled: Boolean(scheduleTimeSeconds),
  };
}

function handleMetaError(errorObj: any, context: string): never {
  const code = errorObj?.code;
  const msg = errorObj?.message || JSON.stringify(errorObj);

  if (code === 190 || msg.includes('access token') || msg.includes('session has expired')) {
    throw new Error('Meta Access Token expired. Please reconnect your Facebook/Instagram account in Accounts.');
  }

  if (code === 36003 || msg.includes('aspect ratio')) {
    throw new Error('Aspect ratio error: Instagram Reels must be in standard vertical 9:16 or supported video ratio.');
  }

  throw new Error(`[${context}] Meta API Error (${code || 'unknown'}): ${msg}`);
}
