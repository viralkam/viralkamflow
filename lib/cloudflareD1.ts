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
