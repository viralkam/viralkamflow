import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { executePublishPost } from '@/lib/publisher';

/**
 * Automated Scheduler & Retry Worker Endpoint
 * 
 * Can be triggered via:
 * 1. Global background runner from client AppContext (every 30-60s)
 * 2. External Cron (Vercel Cron, cron-job.org)
 * 3. Manual "Run Scheduler" button from Dashboard or TopBar
 * 
 * Logic:
 * - Finds posts where status = 'scheduled' AND scheduled_at <= NOW()
 * - Processes each due post through executePublishPost()
 */
export async function GET(request: NextRequest) {
  return handleScheduleWorker(request);
}

export async function POST(request: NextRequest) {
  return handleScheduleWorker(request);
}

async function handleScheduleWorker(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();

    let duePosts: { id: string; client_name: string; platform: string; scheduled_at?: string; status: string }[] = [];

    // 1. Query from Supabase if configured
    if (supabase) {
      try {
        const { data } = await supabase
          .from('posts')
          .select('id, client_name, platform, scheduled_at, status')
          .eq('status', 'scheduled')
          .lte('scheduled_at', nowIso)
          .order('scheduled_at', { ascending: true })
          .limit(10);
        if (data && data.length > 0) {
          duePosts = data;
        }
      } catch {}
    }

    // 2. Query from Local Admin Store
    if (duePosts.length === 0) {
      const { getUserData } = await import('@/lib/userStore');
      const adminData = await getUserData('admin');
      if (adminData && adminData.posts) {
        duePosts = adminData.posts
          .filter(p => p.status === 'scheduled' && p.scheduledAt && new Date(p.scheduledAt).getTime() <= nowMs)
          .map(p => ({
            id: p.id,
            client_name: p.clientName,
            platform: p.platform,
            scheduled_at: p.scheduledAt,
            status: p.status,
          }))
          .slice(0, 10);
      }
    }

    if (!duePosts || duePosts.length === 0) {
      return NextResponse.json({
        message: 'No scheduled posts due for publishing right now.',
        timestamp: nowIso,
        processedCount: 0,
      });
    }

    const results = [];

    // 2. Process each due post
    for (const post of duePosts) {
      try {
        const publishResult = await executePublishPost(post.id);
        results.push({
          id: post.id,
          client: post.client_name,
          platform: post.platform,
          success: publishResult.success,
          error: publishResult.error,
          externalPostId: publishResult.externalPostId,
        });
      } catch (postErr: any) {
        results.push({
          id: post.id,
          client: post.client_name,
          platform: post.platform,
          success: false,
          error: postErr.message,
        });
      }
    }

    return NextResponse.json({
      message: `Processed ${duePosts.length} scheduled post(s).`,
      timestamp: nowIso,
      processedCount: duePosts.length,
      results,
    });
  } catch (err: any) {
    console.error('[Scheduler Worker Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
