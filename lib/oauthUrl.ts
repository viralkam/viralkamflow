import type { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * The canonical production base URL for PublishingFlow.
 * Guaranteed to NEVER have a trailing slash.
 */
export const CANONICAL_APP_BASE_URL = 'https://publishingflow-rc85.vercel.app';

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
 * Isolated callback URL for Facebook OAuth.
 */
export function getFacebookOAuthRedirectUri(request?: NextRequest): string {
  const base = getAppBaseUrl(request);
  return `${base}/api/oauth/facebook/callback`;
}

/**
 * Isolated callback URL for Instagram OAuth.
 */
export function getInstagramOAuthRedirectUri(request?: NextRequest): string {
  const base = getAppBaseUrl(request);
  return `${base}/api/oauth/instagram/callback`;
}

/**
 * Isolated callback URL for Threads OAuth.
 */
export function getThreadsOAuthRedirectUri(request?: NextRequest): string {
  const base = getAppBaseUrl(request);
  return `${base}/api/oauth/threads/callback`;
}

/**
 * Provider-specific OAuth redirect URI resolver.
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
 * Reads local .env.local file directly as fallback for immediate hot reload.
 */
function readEnvKey(key: string): string | undefined {
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
 * Resolves dedicated Facebook App Credentials.
 * Configured via FACEBOOK_APP_ID & FACEBOOK_APP_SECRET (or META_CLIENT_ID / META_CLIENT_SECRET).
 * NO OLD HARDCODED FALLBACK!
 */
export function getCleanFacebookCredentials(): { clientId: string; clientSecret?: string } {
  const rawId = (
    readEnvKey('FACEBOOK_APP_ID') ||
    readEnvKey('FACEBOOK_CLIENT_ID') ||
    readEnvKey('META_CLIENT_ID') ||
    readEnvKey('META_APP_ID') ||
    ''
  ).trim();

  const rawSecret = (
    readEnvKey('FACEBOOK_APP_SECRET') ||
    readEnvKey('FACEBOOK_CLIENT_SECRET') ||
    readEnvKey('META_CLIENT_SECRET') ||
    readEnvKey('META_APP_SECRET') ||
    ''
  ).trim();

  return { clientId: rawId, clientSecret: rawSecret || undefined };
}

/**
 * Backward compatibility alias for Facebook/Meta credentials.
 */
export function getCleanMetaCredentials(): { clientId: string; clientSecret?: string } {
  return getCleanFacebookCredentials();
}

/**
 * Resolves dedicated Instagram App Credentials.
 * Configured via INSTAGRAM_APP_ID & INSTAGRAM_APP_SECRET (or INSTAGRAM_CLIENT_ID / INSTAGRAM_CLIENT_SECRET).
 * NO OLD HARDCODED FALLBACK!
 */
export function getCleanInstagramCredentials(): { clientId: string; clientSecret?: string } {
  const rawId = (
    readEnvKey('INSTAGRAM_APP_ID') ||
    readEnvKey('INSTAGRAM_CLIENT_ID') ||
    readEnvKey('FACEBOOK_APP_ID') ||
    readEnvKey('META_CLIENT_ID') ||
    ''
  ).trim();

  const rawSecret = (
    readEnvKey('INSTAGRAM_APP_SECRET') ||
    readEnvKey('INSTAGRAM_CLIENT_SECRET') ||
    readEnvKey('FACEBOOK_APP_SECRET') ||
    readEnvKey('META_CLIENT_SECRET') ||
    ''
  ).trim();

  return { clientId: rawId, clientSecret: rawSecret || undefined };
}

/**
 * Resolves dedicated Threads App Credentials.
 * Configured via THREADS_APP_ID & THREADS_APP_SECRET (or THREADS_CLIENT_ID / THREADS_CLIENT_SECRET).
 * NO OLD HARDCODED FALLBACK!
 */
export function getCleanThreadsCredentials(): { clientId: string; clientSecret?: string } {
  const rawId = (
    readEnvKey('THREADS_APP_ID') ||
    readEnvKey('THREADS_CLIENT_ID') ||
    readEnvKey('FACEBOOK_APP_ID') ||
    readEnvKey('META_CLIENT_ID') ||
    ''
  ).trim();

  const rawSecret = (
    readEnvKey('THREADS_APP_SECRET') ||
    readEnvKey('THREADS_CLIENT_SECRET') ||
    readEnvKey('FACEBOOK_APP_SECRET') ||
    readEnvKey('META_CLIENT_SECRET') ||
    ''
  ).trim();

  return { clientId: rawId, clientSecret: rawSecret || undefined };
}



/**
 * Standard Facebook OAuth Scopes for Page connection, posting & Auto-Reply.
 * (pages_manage_posts is deprecated/rejected by Meta v19+, replaced by active scopes)
 */
export const DEFAULT_FACEBOOK_SCOPES = 'public_profile,pages_show_list,pages_read_engagement,pages_messaging,pages_manage_metadata';

export function getFacebookScopes(): string {
  return readEnvKey('FACEBOOK_SCOPES') || readEnvKey('META_FACEBOOK_SCOPES') || DEFAULT_FACEBOOK_SCOPES;
}

/**
 * Standard Instagram OAuth Scopes.
 */
export const DEFAULT_INSTAGRAM_SCOPES = 'instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_messages';

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
