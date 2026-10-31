import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { Account, Post, AutoReplyRule } from '@/types';
import { createServerSupabaseClient } from './supabaseServer';

export interface UserRecord {
  id: string;
  username: string;
  name: string;
  email?: string;
  membershipTier?: string;
  passwordHash?: string;
  salt?: string;
  createdAt: string;
}

export interface UserDataFile {
  user: {
    id: string;
    username: string;
    name: string;
    email?: string;
    membershipTier?: string;
    createdAt: string;
  };
  accounts: Account[];
  posts: Post[];
  autoReplyRules: AutoReplyRule[];
}

function isServerless(): boolean {
  return Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    (typeof process.cwd === 'function' && process.cwd().startsWith('/var/task'))
  );
}

function getDataDir(): string {
  if (isServerless()) {
    return path.join(os.tmpdir(), 'publishingflow_data');
  }
  return path.join(process.cwd(), 'data');
}

function getUsersDir(): string {
  return path.join(getDataDir(), 'users');
}

function formatEmailForUsername(username: string): string {
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
  return `${clean}@publishingflow.app`;
}

// In-memory cache
const memoryUsers: Map<string, UserRecord> = new Map();
const memoryUserData: Map<string, UserDataFile> = new Map();

function ensureStore() {
  try {
    const dir = getUsersDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {}
}

export function getUserFilePath(userId: string): string {
  return path.join(getUsersDir(), `${userId}.json`);
}

/**
 * Register a user in Supabase Auth (with real user email)
 */
export async function registerUser(data: { email?: string; username?: string; name: string; password: string }): Promise<{
  success: boolean;
  user?: { id: string; username: string; name: string; email?: string; membershipTier?: string };
  error?: string;
}> {
  const cleanName = data.name.trim();
  const password = data.password;

  if (password.length < 4) {
    return { success: false, error: 'Password must be at least 4 characters.' };
  }

  // Use the actual email provided by the user
  let email = (data.email || '').trim().toLowerCase();
  let cleanUsername = (data.username || '').trim().toLowerCase();

  if (!email && cleanUsername.includes('@')) {
    email = cleanUsername;
    cleanUsername = email.split('@')[0];
  } else if (!email) {
    email = formatEmailForUsername(cleanUsername || cleanName);
  }

  if (!cleanUsername) {
    cleanUsername = email.split('@')[0];
  }

  const supabase = createServerSupabaseClient();

  if (supabase) {
    try {
      // 1. Check if user already exists with this email
      const { data: userList } = await supabase.auth.admin.listUsers();
      const existing = userList?.users?.find(
        u => u.email === email || (cleanUsername && u.user_metadata?.username === cleanUsername)
      );
      if (existing) {
        return { success: false, error: 'An account with this email or username already exists. Please sign in.' };
      }

      // 2. Create in Supabase Auth with real user email
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username: cleanUsername,
          name: cleanName,
          membershipTier: 'Free Member',
          role: 'member',
          accounts: [],
          autoReplyRules: [],
        },
      });

      if (createErr || !newUser?.user) {
        return { success: false, error: createErr?.message || 'Failed to create user in database.' };
      }

      const createdUser = {
        id: newUser.user.id,
        username: cleanUsername,
        name: cleanName,
        email: email,
        membershipTier: 'Free Member',
      };

      // Cache locally
      const initialData: UserDataFile = {
        user: {
          id: createdUser.id,
          username: cleanUsername,
          name: cleanName,
          membershipTier: 'Free Member',
          createdAt: new Date().toISOString(),
        },
        accounts: [],
        posts: [],
        autoReplyRules: [],
      };
      memoryUserData.set(createdUser.id, initialData);

      try {
        ensureStore();
        fs.writeFileSync(getUserFilePath(createdUser.id), JSON.stringify(initialData, null, 2), 'utf-8');
      } catch {}

      return { success: true, user: createdUser };
    } catch (err: any) {
      console.error('[UserStore Supabase Register Error]:', err);
    }
  }

  // Local fallback if Supabase is unavailable
  ensureStore();
  const userId = `usr_${cleanUsername}`;
  const userRec: UserRecord = {
    id: userId,
    username: cleanUsername,
    name: cleanName,
    membershipTier: 'Free Member',
    createdAt: new Date().toISOString(),
  };
  memoryUsers.set(userId, userRec);

  const initialData: UserDataFile = {
    user: {
      id: userId,
      username: cleanUsername,
      name: cleanName,
      membershipTier: 'Free Member',
      createdAt: new Date().toISOString(),
    },
    accounts: [],
    posts: [],
    autoReplyRules: [],
  };
  memoryUserData.set(userId, initialData);

  try {
    fs.writeFileSync(getUserFilePath(userId), JSON.stringify(initialData, null, 2), 'utf-8');
  } catch {}

  return { success: true, user: userRec };
}

/**
 * Authenticate user via Supabase Auth (with local fallback)
 */
export async function authenticateUser(emailInput: string, password: string): Promise<{
  success: boolean;
  user?: { id: string; username: string; name: string; email?: string; membershipTier?: string };
  error?: string;
}> {
  const cleanEmail = emailInput.trim().toLowerCase();

  // Enforce strict email requirement to prevent collisions between identical usernames
  if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    return {
      success: false,
      error: 'Invalid email or password.',
    };
  }

  const supabase = createServerSupabaseClient();

  if (supabase) {
    try {
      // 1. Direct secure authentication with unique email
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (!signInErr && signInData.user) {
        const u = signInData.user;
        const meta = u.user_metadata || {};
        const userObj = {
          id: u.id,
          username: meta.username || cleanEmail.split('@')[0],
          name: meta.name || cleanEmail.split('@')[0],
          email: u.email || cleanEmail,
          membershipTier: meta.membershipTier || 'Free Member',
        };

        // Sync local cache
        if (!memoryUserData.has(u.id)) {
          memoryUserData.set(u.id, {
            user: { ...userObj, createdAt: u.created_at },
            accounts: meta.accounts || [],
            posts: meta.posts || [],
            autoReplyRules: meta.autoReplyRules || [],
          });
        }

        return { success: true, user: userObj };
      }

      return { success: false, error: 'Incorrect email or password. Please try again.' };
    } catch (err: any) {
      console.error('[UserStore Supabase Login Error]:', err);
    }
  }

  // Fallback in-memory / local files
  for (const [id, u] of memoryUsers.entries()) {
    if (u.username === cleanEmail || (u as any).email === cleanEmail) {
      return { success: true, user: u };
    }
  }

  return { success: false, error: 'User not found. Please register first.' };
}

/**
 * Find user by ID (Supabase Auth first, then local cache)
 */
export async function findUserById(userId: string): Promise<UserRecord | null> {
  const supabase = createServerSupabaseClient();
  if (supabase) {
    try {
      // 1. Direct fetch if UUID
      if (!userId.startsWith('usr_')) {
        const { data } = await supabase.auth.admin.getUserById(userId);
        if (data?.user) {
          const meta = data.user.user_metadata || {};
          return {
            id: data.user.id,
            username: meta.username || data.user.email?.split('@')[0] || 'user',
            name: meta.name || 'User',
            email: data.user.email,
            membershipTier: meta.membershipTier || 'Free Member',
            createdAt: data.user.created_at,
          };
        }
      }

      // 2. Lookup legacy or non-UUID session
      const cleanName = userId.replace(/^usr_/, '').toLowerCase();
      const { data: userList } = await supabase.auth.admin.listUsers();
      const matched = userList?.users?.find(
        u => u.user_metadata?.username?.toLowerCase() === cleanName ||
             u.email?.toLowerCase().startsWith(cleanName) ||
             u.id === userId
      );
      if (matched) {
        const meta = matched.user_metadata || {};
        return {
          id: matched.id,
          username: meta.username || matched.email?.split('@')[0] || cleanName,
          name: meta.name || cleanName,
          email: matched.email,
          membershipTier: meta.membershipTier || 'Free Member',
          createdAt: matched.created_at,
        };
      }
    } catch (err) {
      console.warn('[UserStore findUserById error]:', err);
    }
  }

  if (memoryUsers.has(userId)) return memoryUsers.get(userId)!;
  if (memoryUserData.has(userId)) {
    const d = memoryUserData.get(userId)!;
    return {
      id: d.user.id,
      username: d.user.username,
      name: d.user.name,
      membershipTier: d.user.membershipTier || 'Free Member',
      createdAt: d.user.createdAt,
    };
  }

  if (userId === 'admin') {
    return {
      id: 'admin',
      username: 'admin',
      name: 'Admin',
      membershipTier: 'Administrator',
      createdAt: new Date().toISOString(),
    };
  }

  return null;
}

/**
 * Get user data (Accounts, Posts, Rules) with Supabase persistence
 */
export async function getUserData(userId: string): Promise<UserDataFile | null> {
  // Fast path for Admin: instant load from memory or local disk in < 1ms
  if (userId === 'admin') {
    if (memoryUserData.has('admin')) {
      return memoryUserData.get('admin')!;
    }
    const adminPath = getUserFilePath('admin');
    try {
      if (fs.existsSync(adminPath)) {
        const raw = fs.readFileSync(adminPath, 'utf-8');
        const parsed = JSON.parse(raw);
        memoryUserData.set('admin', parsed);
        return parsed;
      }
    } catch {}

    const defaultAdmin: UserDataFile = {
      user: {
        id: 'admin',
        username: 'admin',
        name: 'Admin',
        membershipTier: 'Administrator',
        createdAt: new Date().toISOString(),
      },
      accounts: [],
      posts: [],
      autoReplyRules: [],
    };
    memoryUserData.set('admin', defaultAdmin);
    return defaultAdmin;
  }

  const supabase = createServerSupabaseClient();
  if (supabase) {
    try {
      let targetUser: any = null;

      // 1. Direct fetch if valid UUID
      if (!userId.startsWith('usr_')) {
        const { data } = await supabase.auth.admin.getUserById(userId);
        if (data?.user) targetUser = data.user;
      }

      // 2. Fallback search by username/email in Supabase Auth
      if (!targetUser) {
        const cleanName = userId.replace(/^usr_/, '').toLowerCase();
        const { data: userList } = await supabase.auth.admin.listUsers();
        targetUser = userList?.users?.find(
          u => u.id === userId ||
               u.user_metadata?.username?.toLowerCase() === cleanName ||
               u.email?.toLowerCase().startsWith(cleanName)
        );
      }

      if (targetUser) {
        const meta = targetUser.user_metadata || {};
        const userData: UserDataFile = {
          user: {
            id: targetUser.id,
            username: meta.username || targetUser.email?.split('@')[0] || 'user',
            name: meta.name || 'User',
            membershipTier: meta.membershipTier || 'Free Member',
            createdAt: targetUser.created_at,
          },
          accounts: meta.accounts || [],
          posts: meta.posts || [],
          autoReplyRules: meta.autoReplyRules || [],
        };
        memoryUserData.set(userId, userData);
        memoryUserData.set(targetUser.id, userData);
        return userData;
      }
    } catch (err) {
      console.warn('[UserStore getUserData Supabase Error]:', err);
    }
  }

  // Check in-memory cache
  if (memoryUserData.has(userId)) {
    return memoryUserData.get(userId)!;
  }

  // Check file on disk
  const filePath = getUserFilePath(userId);
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      memoryUserData.set(userId, parsed);
      return parsed;
    }
  } catch {}

  if (userId === 'admin') {
    const defaultAdmin: UserDataFile = {
      user: {
        id: 'admin',
        username: 'admin',
        name: 'Admin',
        membershipTier: 'Administrator',
        createdAt: new Date().toISOString(),
      },
      accounts: [],
      posts: [],
      autoReplyRules: [],
    };
    memoryUserData.set('admin', defaultAdmin);
    return defaultAdmin;
  }

  return null;
}

/**
 * Save user data (persist to Supabase Auth user_metadata and local disk)
 */
export async function saveUserData(userId: string, data: UserDataFile) {
  memoryUserData.set(userId, data);
  if (data.user?.id) {
    memoryUserData.set(data.user.id, data);
  }

  // 1. Persist to disk
  try {
    ensureStore();
    fs.writeFileSync(getUserFilePath(userId), JSON.stringify(data, null, 2), 'utf-8');
  } catch {}

  // 2. Persist to Supabase Auth metadata
  const supabase = createServerSupabaseClient();
  if (supabase) {
    try {
      let targetUuid = data.user?.id || userId;
      if (targetUuid.startsWith('usr_')) {
        const cleanName = targetUuid.replace(/^usr_/, '').toLowerCase();
        const { data: userList } = await supabase.auth.admin.listUsers();
        const matched = userList?.users?.find(
          u => u.user_metadata?.username?.toLowerCase() === cleanName ||
               u.email?.toLowerCase().startsWith(cleanName)
        );
        if (matched) targetUuid = matched.id;
      }

      await supabase.auth.admin.updateUserById(targetUuid, {
        user_metadata: {
          username: data.user.username,
          name: data.user.name,
          membershipTier: data.user.membershipTier || 'Free Member',
          accounts: data.accounts,
          posts: data.posts,
          autoReplyRules: data.autoReplyRules,
        },
      });
    } catch (err) {
      console.warn(`[UserStore] Supabase save error for ${userId}:`, err);
    }
  }
}

/**
 * Add or update an account for a user
 */
export async function addAccountToUser(userId: string, account: Account): Promise<boolean> {
  const data = await getUserData(userId);
  if (!data) return false;

  const existingIdx = data.accounts.findIndex(
    a => a.id === account.id || (a.platform === account.platform && a.clientName === account.clientName)
  );

  if (existingIdx >= 0) {
    data.accounts[existingIdx] = account;
  } else {
    data.accounts.unshift(account);
  }

  await saveUserData(userId, data);
  return true;
}

/**
 * Remove an account from user
 */
export async function removeAccountFromUser(userId: string, accountId: string): Promise<boolean> {
  const data = await getUserData(userId);
  if (data) {
    data.accounts = data.accounts.filter(a => a.id !== accountId);
    await saveUserData(userId, data);
  }

  try {
    const { getD1Config, deleteD1Account } = await import('@/lib/cloudflareD1');
    if (getD1Config().isConfigured) {
      await deleteD1Account(accountId);
    }
  } catch (d1Err) {
    console.warn('[UserStore D1 Delete Error]:', d1Err);
  }

  return true;
}
