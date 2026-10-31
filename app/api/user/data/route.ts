import { NextRequest, NextResponse } from 'next/server';
import { getUserData, saveUserData } from '@/lib/userStore';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { mapPostFromDb, mapAccountFromDb } from '@/lib/supabase';
import { getD1Config, getD1Accounts, getD1Posts } from '@/lib/cloudflareD1';

export async function GET(req: NextRequest) {
  const sessionUserId = req.cookies.get('pf_session_user_id')?.value || 'admin';

  let userData = await getUserData(sessionUserId);
  if (!userData) {
    userData = {
      user: {
        id: sessionUserId,
        username: 'admin',
        name: 'Admin',
        membershipTier: 'Administrator',
        createdAt: new Date().toISOString(),
      },
      accounts: [],
      posts: [],
      autoReplyRules: [],
    };
  }

  // 1. Cloudflare D1 Database Sync (Primary Serverless Database)
  const d1Config = getD1Config();
  if (d1Config.isConfigured) {
    try {
      const [d1Accs, d1Posts] = await Promise.all([
        getD1Accounts(sessionUserId),
        getD1Posts(sessionUserId),
      ]);

      if (d1Accs && d1Accs.length > 0) {
        const accMap = new Map();
        for (const a of [...d1Accs, ...(userData.accounts || [])]) {
          accMap.set(a.id, a);
        }
        userData.accounts = Array.from(accMap.values());
      }

      if (d1Posts && d1Posts.length > 0) {
        const postMap = new Map();
        for (const p of [...d1Posts, ...(userData.posts || [])]) {
          postMap.set(p.id, p);
        }
        userData.posts = Array.from(postMap.values());
      }
    } catch (d1Err) {
      console.warn('[UserData D1 Sync Notice]:', d1Err);
    }
  }

  // 2. Supabase DB Sync (If configured)
  const supabase = createServerSupabaseClient();
  if (supabase) {
    try {
      const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 80));
      const syncPromise = Promise.all([
        supabase.from('accounts').select('*').order('created_at', { ascending: false }),
        supabase.from('posts').select('*').order('created_at', { ascending: false }),
      ]).then(([accRes, postRes]) => {
        if (accRes.data && accRes.data.length > 0) {
          const mappedAccs = accRes.data.map(mapAccountFromDb);
          const accMap = new Map();
          for (const a of [...mappedAccs, ...(userData.accounts || [])]) {
            accMap.set(a.id, a);
          }
          userData.accounts = Array.from(accMap.values());
        }
        if (postRes.data && postRes.data.length > 0) {
          const mappedPosts = postRes.data.map(mapPostFromDb);
          const postMap = new Map();
          for (const p of [...mappedPosts, ...(userData.posts || [])]) {
            postMap.set(p.id, p);
          }
          userData.posts = Array.from(postMap.values()).sort((a, b) => {
            const tA = new Date(a.scheduledAt || a.createdAt).getTime();
            const tB = new Date(b.scheduledAt || b.createdAt).getTime();
            return tB - tA;
          });
        }
      });

      await Promise.race([syncPromise, timeoutPromise]);
    } catch (e) {
      console.warn('[UserData Supabase Merge Notice]:', e);
    }
  }

  const response = NextResponse.json({
    success: true,
    data: userData,
  });

  if (!req.cookies.get('pf_session_user_id')?.value) {
    response.cookies.set('pf_session_user_id', 'admin', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}

export async function POST(req: NextRequest) {
  const sessionUserId = req.cookies.get('pf_session_user_id')?.value || 'admin';

  let existingData = await getUserData(sessionUserId);
  if (!existingData) {
    existingData = {
      user: {
        id: sessionUserId,
        username: 'admin',
        name: 'Admin',
        membershipTier: 'Administrator',
        createdAt: new Date().toISOString(),
      },
      accounts: [],
      posts: [],
      autoReplyRules: [],
    };
  }

  try {
    const body = await req.json();
    const { action, payload } = body;

    if (action === 'delete_account') {
      existingData.accounts = existingData.accounts.filter(a => a.id !== payload.id);
      await saveUserData(sessionUserId, existingData);
      return NextResponse.json({ success: true, data: existingData });
    }

    if (action === 'save_all') {
      if (payload.accounts) existingData.accounts = payload.accounts;
      if (payload.posts) existingData.posts = payload.posts;
      if (payload.autoReplyRules) existingData.autoReplyRules = payload.autoReplyRules;
      await saveUserData(sessionUserId, existingData);
      return NextResponse.json({ success: true, data: existingData });
    }

    if (action === 'add_rule') {
      existingData.autoReplyRules = [payload.rule, ...(existingData.autoReplyRules || [])];
      await saveUserData(sessionUserId, existingData);
      return NextResponse.json({ success: true, data: existingData });
    }

    if (action === 'delete_rule') {
      existingData.autoReplyRules = (existingData.autoReplyRules || []).filter(r => r.id !== payload.id);
      await saveUserData(sessionUserId, existingData);
      return NextResponse.json({ success: true, data: existingData });
    }

    if (action === 'increment_rule') {
      existingData.autoReplyRules = (existingData.autoReplyRules || []).map(r =>
        r.id === payload.id ? { ...r, triggerCount: (r.triggerCount || 0) + 1 } : r
      );
      await saveUserData(sessionUserId, existingData);
      return NextResponse.json({ success: true, data: existingData });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (err: any) {
    console.error('[UserData POST Error]:', err);
    return NextResponse.json({ error: err.message || 'Failed to update user data.' }, { status: 500 });
  }
}
