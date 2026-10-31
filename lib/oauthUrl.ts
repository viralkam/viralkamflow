import type { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * The canonical production base URL for ViralKamFlow.
 * Guaranteed to NEVER have a trailing slash.
 */
export const CANONICAL_APP_BASE_URL = 'https://viralkamflow.vercel.app';

/**
 * Reads local .env.local file directly as fallback for immediate hot reload.
 */
export function readEnvKey(key: string): string | undefined {
  if (process.env[key]) {
    const val = process.env[key]?.trim().replace(/^["']|["']$/g, '');
    if (val) return val;
  }
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const text = fs.readFileSync(envPath, 'utf8');
      const regex = new RegExp(`^${key}\\s*=\\s*([^\\r\\n]+)`, 'm');
      const match = text.match(regex);
      if (match && match[1]) {
        return match[1].trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch {}
  return undefined;
}

/**
 * Returns the sanitized base URL of the application.
 * Dynamically uses current request origin (supporting localhost & custom domains).
 */
export function getAppBaseUrl(request?: NextRequest): string {
  if (request) {
    const origin = request.nextUrl.origin?.replace(/\/+$/, '');
    if (origin && !origin.includes('undefined')) {
      return origin;
    }
    const host = request.headers.get('host');
    if (host) {
      const proto = request.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
      return `${proto}://${host}`.replace(/\/+$/, '');
    }
  }

  let envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/^["']|["']$/g, '');
  if (envUrl) {
    envUrl = envUrl.replace(/\/api\/oauth.*$/i, '').replace(/\/+$/, '');
    try {
      const parsed = new URL(envUrl.startsWith('http') ? envUrl : `https://${envUrl}`);
      return parsed.origin;
    } catch {
      const match = envUrl.match(/^(https?:\/\/[^\/\s]+)/i);
      if (match) return match[1].replace(/\/+$/, '');
    }
  }

  return CANONICAL_APP_BASE_URL;
}

/**
 * Dedicated callback URL for Facebook OAuth.
 */
export function getFacebookOAuthRedirectUri(request?: NextRequest): string {
  const custom = readEnvKey('FACEBOOK_REDIRECT_URI');
  if (custom) return custom;
  const base = getAppBaseUrl(request);
  return `${base}/api/oauth/facebook/callback`;
}

/**
 * Dedicated callback URL for Instagram OAuth (Unified Login).
 */
export function getInstagramOAuthRedirectUri(request?: NextRequest): string {
  const custom = readEnvKey('INSTAGRAM_REDIRECT_URI');
  if (custom) return custom;
  const base = getAppBaseUrl(request);
  return `${base}/api/oauth/instagram/callback`;
}

/**
 * Dedicated callback URL for Threads OAuth.
 */
export function getThreadsOAuthRedirectUri(request?: NextRequest): string {
  const custom = readEnvKey('THREADS_REDIRECT_URI');
  if (custom) return custom;
  const base = getAppBaseUrl(request);
  return `${base}/api/oauth/threads/callback`;
}

/**
 * Platform-specific OAuth redirect URI resolver.
 */
export function getOAuthRedirectUri(platform: string, request?: NextRequest): string {
  const key = platform.toLowerCase();
  if (key === 'facebook') return getFacebookOAuthRedirectUri(request);
  if (key === 'instagram') return getInstagramOAuthRedirectUri(request);
  if (key === 'threads') return getThreadsOAuthRedirectUri(request);

  const base = getAppBaseUrl(request);
  return `${base}/api/oauth/${key}/callback`;
}

/**
 * Resolves dedicated Facebook App Credentials.
 * Configured via META_CLIENT_ID / META_CLIENT_SECRET or FACEBOOK_APP_ID / FACEBOOK_APP_SECRET.
 */
export function getCleanFacebookCredentials(): { clientId: string; clientSecret?: string } {
  const rawId = (
    readEnvKey('META_CLIENT_ID') ||
    readEnvKey('FACEBOOK_APP_ID') ||
    readEnvKey('FACEBOOK_CLIENT_ID') ||
    readEnvKey('META_APP_ID') ||
    ''
  ).trim();

  const rawSecret = (
    readEnvKey('META_CLIENT_SECRET') ||
    readEnvKey('FACEBOOK_APP_SECRET') ||
    readEnvKey('FACEBOOK_CLIENT_SECRET') ||
    readEnvKey('META_APP_SECRET') ||
    ''
  ).trim();

  return { clientId: rawId, clientSecret: rawSecret || undefined };
}

/**
 * Alias for backward compatibility.
 */
export function getCleanMetaCredentials(): { clientId: string; clientSecret?: string } {
  return getCleanFacebookCredentials();
}

/**
 * Resolves Instagram API Unified Login Credentials.
 * Uses META_CLIENT_ID and META_CLIENT_SECRET as documented by Meta for Unified Login.
 * Also retrieves the Unified Login Configuration ID (config_id).
 */
export function getCleanInstagramCredentials(): {
  clientId: string;
  clientSecret?: string;
  configId?: string;
} {
  // In Unified Login, client credentials are the Meta App credentials
  const rawId = (
    readEnvKey('META_CLIENT_ID') ||
    readEnvKey('FACEBOOK_APP_ID') ||
    readEnvKey('INSTAGRAM_CLIENT_ID') ||
    readEnvKey('INSTAGRAM_APP_ID') ||
    ''
  ).trim();

  const rawSecret = (
    readEnvKey('META_CLIENT_SECRET') ||
    readEnvKey('FACEBOOK_APP_SECRET') ||
    readEnvKey('INSTAGRAM_CLIENT_SECRET') ||
    readEnvKey('INSTAGRAM_APP_SECRET') ||
    ''
  ).trim();

  const rawConfigId = (
    readEnvKey('INSTAGRAM_CONFIG_ID') ||
    readEnvKey('META_CONFIG_ID') ||
    readEnvKey('CONFIG_ID') ||
    ''
  ).trim();

  return {
    clientId: rawId,
    clientSecret: rawSecret || undefined,
    configId: rawConfigId || undefined,
  };
}

/**
 * Resolves dedicated Threads App Credentials.
 * Configured via THREADS_APP_ID & THREADS_APP_SECRET.
 */
export function getCleanThreadsCredentials(): { clientId: string; clientSecret?: string } {
  const rawId = (
    readEnvKey('THREADS_APP_ID') ||
    readEnvKey('THREADS_CLIENT_ID') ||
    readEnvKey('META_CLIENT_ID') ||
    readEnvKey('FACEBOOK_APP_ID') ||
    ''
  ).trim();

  const rawSecret = (
    readEnvKey('THREADS_APP_SECRET') ||
    readEnvKey('THREADS_CLIENT_SECRET') ||
    readEnvKey('META_CLIENT_SECRET') ||
    readEnvKey('FACEBOOK_APP_SECRET') ||
    ''
  ).trim();

  return { clientId: rawId, clientSecret: rawSecret || undefined };
}

/**
 * Standard Facebook OAuth Scopes for Page connection, posting & Auto-Reply.
 */
export const DEFAULT_FACEBOOK_SCOPES =
  'public_profile,pages_show_list,pages_read_engagement,pages_manage_posts,pages_messaging,pages_read_user_content';

export function getFacebookScopes(): string {
  return readEnvKey('FACEBOOK_SCOPES') || readEnvKey('META_FACEBOOK_SCOPES') || DEFAULT_FACEBOOK_SCOPES;
}

/**
 * Standard Instagram Unified Login Scopes (used as fallback if config_id not provided).
 */
export const DEFAULT_INSTAGRAM_SCOPES =
  'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish';

export function getInstagramScopes(): string {
  return readEnvKey('INSTAGRAM_SCOPES') || DEFAULT_INSTAGRAM_SCOPES;
}

/**
 * Standard Threads OAuth Scopes.
 */
export const DEFAULT_THREADS_SCOPES = 'threads_basic,threads_content_publish';

export function getThreadsScopes(): string {
  return readEnvKey('THREADS_SCOPES') || DEFAULT_THREADS_SCOPES;
}

/**
 * Meta Unified Login Configuration ID helper
 */
export function getMetaConfigId(): string | undefined {
  return (
    readEnvKey('INSTAGRAM_CONFIG_ID') ||
    readEnvKey('META_CONFIG_ID') ||
    readEnvKey('CONFIG_ID') ||
    undefined
  );
}
