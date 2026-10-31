import { Account, Post, AutoReplyRule } from '@/types';

/**
 * Cloudflare D1 Serverless SQLite Database Client
 * 
 * Directly queries Cloudflare D1 via Cloudflare's official D1 REST API.
 * Works seamlessly across Vercel, Localhost, and Cloudflare Pages.
 */

export interface D1QueryResponse<T = any> {
  result: Array<{
    results: T[];
    success: boolean;
    meta?: Record<string, any>;
  }>;
  success: boolean;
  errors: any[];
  messages: any[];
}

export function getD1Config(): {
  accountId: string;
  databaseId: string;
  apiToken: string;
  isConfigured: boolean;
} {
  const accountId = (
    process.env.CLOUDFLARE_ACCOUNT_ID ||
    '8348da430a621adc2e77fdb6e3b83243'
  ).trim();

  const databaseId = (
    process.env.CLOUDFLARE_D1_DATABASE_ID ||
    process.env.CLOUDFLARE_DATABASE_ID ||
    ''
  ).trim();

  const apiToken = (
    process.env.CLOUDFLARE_API_TOKEN ||
    process.env.CLOUDFLARE_D1_API_TOKEN ||
    ''
  ).trim();

  const isConfigured = Boolean(accountId && databaseId && apiToken);

  return { accountId, databaseId, apiToken, isConfigured };
}

/**
 * Execute a SQL query on Cloudflare D1 and return typed results
 */
export async function queryD1<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const { accountId, databaseId, apiToken, isConfigured } = getD1Config();

  if (!isConfigured) {
    return [];
  }

  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
      cache: 'no-store',
    });

    const data: D1QueryResponse<T> = await res.json();
    if (res.ok && data.success && data.result?.[0]?.results) {
      return data.result[0].results;
    }

    if (data.errors && data.errors.length > 0) {
      console.warn('[Cloudflare D1 Error]:', data.errors);
    }
  } catch (err) {
    console.warn('[Cloudflare D1 Query Exception]:', err);
  }

  return [];
}

/**
 * Execute an INSERT, UPDATE, or DELETE statement on Cloudflare D1
 */
export async function executeD1(sql: string, params: any[] = []): Promise<boolean> {
  const { accountId, databaseId, apiToken, isConfigured } = getD1Config();

  if (!isConfigured) {
    return false;
  }

  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    });

    const data: D1QueryResponse = await res.json();
    return res.ok && data.success;
  } catch (err) {
    console.warn('[Cloudflare D1 Execute Exception]:', err);
    return false;
  }
}

/**
 * Automatically ensure D1 tables exist in the database (Idempotent)
 */
export async function initD1Schema(): Promise<boolean> {
  const { isConfigured } = getD1Config();
  if (!isConfigured) return false;

  const createTablesSql = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT,
      membership_tier TEXT DEFAULT 'pro',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT DEFAULT 'admin',
      client_id TEXT,
      client_name TEXT NOT NULL,
      platform TEXT NOT NULL,
      connection_type TEXT NOT NULL DEFAULT 'oauth',
      connection_status TEXT NOT NULL DEFAULT 'Connected',
      oauth_access_token TEXT,
      oauth_refresh_token TEXT,
      oauth_account_id TEXT,
      oauth_token_expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      user_id TEXT DEFAULT 'admin',
      client_id TEXT,
      account_id TEXT,
      client_name TEXT NOT NULL,
      platform TEXT NOT NULL,
      title TEXT DEFAULT '',
      caption TEXT DEFAULT '',
      description TEXT DEFAULT '',
      media_type TEXT,
      media_url TEXT,
      media_name TEXT,
      scheduled_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      published_at TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `;

  return executeD1(createTablesSql);
}

/**
 * Fetch all social accounts from D1 for a user
 */
export async function getD1Accounts(userId = 'admin'): Promise<Account[]> {
  const rows = await queryD1<any>(
    'SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );

  return rows.map((r) => ({
    id: r.id,
    clientName: r.client_name,
    platform: r.platform,
    connectionType: r.connection_type || 'oauth',
    connectionStatus: r.connection_status || 'Connected',
    oauthAccountId: r.oauth_account_id || undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at || r.created_at,
  }));
}

/**
 * Upsert an account into D1
 */
export async function saveD1Account(userId = 'admin', acc: Account & { oauthAccessToken?: string; oauthRefreshToken?: string; oauthTokenExpiresAt?: string }): Promise<boolean> {
  const sql = `
    INSERT INTO accounts (
      id, user_id, client_id, client_name, platform, connection_type, connection_status,
      oauth_access_token, oauth_refresh_token, oauth_account_id, oauth_token_expires_at,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      client_name = excluded.client_name,
      connection_status = excluded.connection_status,
      oauth_access_token = COALESCE(excluded.oauth_access_token, accounts.oauth_access_token),
      oauth_refresh_token = COALESCE(excluded.oauth_refresh_token, accounts.oauth_refresh_token),
      oauth_account_id = COALESCE(excluded.oauth_account_id, accounts.oauth_account_id),
      oauth_token_expires_at = COALESCE(excluded.oauth_token_expires_at, accounts.oauth_token_expires_at),
      updated_at = datetime('now')
  `;

  const now = new Date().toISOString();
  return executeD1(sql, [
    acc.id,
    userId,
    acc.clientId || null,
    acc.clientName,
    acc.platform,
    acc.connectionType || 'oauth',
    acc.connectionStatus || 'Connected',
    acc.oauthAccessToken || null,
    acc.oauthRefreshToken || null,
    acc.oauthAccountId || null,
    acc.oauthTokenExpiresAt || null,
    acc.createdAt || now,
    acc.updatedAt || now,
  ]);
}

/**
 * Delete account from D1
 */
export async function deleteD1Account(id: string): Promise<boolean> {
  return executeD1('DELETE FROM accounts WHERE id = ?', [id]);
}

/**
 * Fetch all posts from D1
 */
export async function getD1Posts(userId = 'admin'): Promise<Post[]> {
  const rows = await queryD1<any>(
    'SELECT * FROM posts WHERE user_id = ? ORDER BY scheduled_at DESC',
    [userId]
  );

  return rows.map((r) => ({
    id: r.id,
    accountId: r.account_id || undefined,
    clientName: r.client_name,
    platform: r.platform,
    title: r.title || '',
    caption: r.caption || '',
    description: r.description || '',
    mediaUrl: r.media_url || undefined,
    mediaType: r.media_type || undefined,
    mediaName: r.media_name || undefined,
    isScheduled: true,
    scheduledAt: r.scheduled_at,
    status: r.status,
    publishedAt: r.published_at || undefined,
    retryCount: r.retry_count || 0,
    maxRetries: r.max_retries || 3,
    lastError: r.last_error || undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at || r.created_at,
  }));
}
