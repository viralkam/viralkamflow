import type { NextRequest } from 'next/server';

/**
 * The canonical production base URL for PublishingFlow.
 * Guaranteed to NEVER have a trailing slash.
 */
export const CANONICAL_APP_BASE_URL = 'https://publishingflow-rc85.vercel.app';

/**
 * Deprecated old Consumer App ID.
 */
export const DEPRECATED_META_APP_ID = '1077484934693230';

/**
 * Verified Facebook / Meta Business App ID for PublishingFlow.
 */
export const VERIFIED_META_APP_ID = '1656696732464075';
export const VERIFIED_META_APP_SECRET = 'b483be922e7f2a603902364c434ae594';

/**
 * Returns the sanitized base URL of the application.
 * Dynamically uses the current request origin so rc85, custom domains, and localhost work seamlessly.
 */
export function getAppBaseUrl(request?: NextRequest): string {
  if (request) {
    const origin = request.nextUrl.origin.replace(/\/+$/, '');
    if (origin && !origin.includes('undefined')) {
      return origin;
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
      if (match) {
        return match[1].replace(/\/+$/, '');
      }
    }
  }

  return CANONICAL_APP_BASE_URL;
}

/**
 * Distinct, isolated callback URL for Facebook OAuth.
 */
export function getFacebookOAuthRedirectUri(request?: NextRequest): string {
  const base = getAppBaseUrl(request);
  return `${base}/api/oauth/facebook/callback`;
}

/**
 * Distinct, isolated callback URL for Instagram OAuth.
 */
export function getInstagramOAuthRedirectUri(request?: NextRequest): string {
  const base = getAppBaseUrl(request);
  return `${base}/api/oauth/instagram/callback`;
}

/**
 * Distinct, isolated callback URL for Threads OAuth.
 */
export function getThreadsOAuthRedirectUri(request?: NextRequest): string {
  const base = getAppBaseUrl(request);
  return `${base}/api/oauth/threads/callback`;
}

/**
 * Distinct, isolated callback URL for YouTube OAuth.
 */
export function getYouTubeOAuthRedirectUri(request?: NextRequest): string {
  const base = getAppBaseUrl(request);
  return `${base}/api/oauth/youtube/callback`;
}

/**
 * Provider-specific OAuth redirect URI resolver.
 */
export function getOAuthRedirectUri(platform: string, request?: NextRequest): string {
  const key = platform.toLowerCase();
  if (key === 'facebook') return getFacebookOAuthRedirectUri(request);
  if (key === 'instagram') return getInstagramOAuthRedirectUri(request);
  if (key === 'threads') return getThreadsOAuthRedirectUri(request);
  if (key === 'youtube') return getYouTubeOAuthRedirectUri(request);

  const base = getAppBaseUrl(request);
  return `${base}/api/oauth/${key}/callback`;
}

/**
 * Resolves clean Meta credentials (App ID and Secret).
 */
export function getCleanMetaCredentials(): { clientId: string; clientSecret?: string } {
  const rawId = (
    process.env.META_CLIENT_ID ||
    process.env.META_APP_ID ||
    process.env.FACEBOOK_APP_ID ||
    VERIFIED_META_APP_ID
  )?.trim().replace(/^["']|["']$/g, '');

  const rawSecret = (
    process.env.META_CLIENT_SECRET ||
    process.env.META_APP_SECRET ||
    process.env.FACEBOOK_APP_SECRET ||
    VERIFIED_META_APP_SECRET
  )?.trim().replace(/^["']|["']$/g, '');

  let cleanId = rawId ? rawId.replace(/^your-/i, '') : '';
  if (!cleanId || cleanId === DEPRECATED_META_APP_ID) {
    cleanId = VERIFIED_META_APP_ID;
  }

  let clientSecret = rawSecret ? rawSecret.replace(/^your-/i, '') : undefined;
  if (!clientSecret || rawId === DEPRECATED_META_APP_ID || clientSecret === 'e8b47d511762d7c70c4ac7f1c7241b93') {
    clientSecret = VERIFIED_META_APP_SECRET;
  }

  return { clientId: cleanId, clientSecret };
}

/**
 * Verified permissions for Facebook Page connection, content publishing, and Auto-Reply.
 */
export const DEFAULT_FACEBOOK_SCOPES = 'public_profile,pages_show_list,pages_manage_posts';

/**
 * Returns clean Facebook OAuth scopes, allowing override via META_FACEBOOK_SCOPES.
 */
export function getFacebookScopes(): string {
  const envScopes = process.env.META_FACEBOOK_SCOPES?.trim().replace(/^["']|["']$/g, '');
  return envScopes || DEFAULT_FACEBOOK_SCOPES;
}

/**
 * Builds the official Meta Facebook OAuth authorization dialog URL.
 */
export function buildFacebookOAuthUrl(clientId: string, redirectUri: string): string {
  const configId = (process.env.META_CONFIG_ID || process.env.FACEBOOK_CONFIG_ID)?.trim().replace(/^["']|["']$/g, '');

  if (configId) {
    return `https://www.facebook.com/v22.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&config_id=${encodeURIComponent(configId)}&response_type=code`;
  }

  const scopes = getFacebookScopes();
  return `https://www.facebook.com/v22.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${encodeURIComponent(scopes)}&response_type=code`;
}

/**
 * Resolves clean Google credentials with immediate disk fallback for local development.
 */
export function getCleanGoogleCredentials(): { clientId?: string; clientSecret?: string } {
  let clientId = (process.env.GOOGLE_CLIENT_ID || '')?.trim().replace(/^["']|["']$/g, '');
  let clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '')?.trim().replace(/^["']|["']$/g, '');

  if (!clientId || !clientSecret || clientId.includes('your-google')) {
    try {
      const fs = require('fs');
      const path = require('path');
      const envPath = path.join(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const text = fs.readFileSync(envPath, 'utf8');
        const idMatch = text.match(/GOOGLE_CLIENT_ID\s*=\s*([^\r\n]+)/);
        const secMatch = text.match(/GOOGLE_CLIENT_SECRET\s*=\s*([^\r\n]+)/);
        if (idMatch && idMatch[1]) clientId = idMatch[1].trim().replace(/^["']|["']$/g, '');
        if (secMatch && secMatch[1]) clientSecret = secMatch[1].trim().replace(/^["']|["']$/g, '');
      }
    } catch {
      // safe catch
    }
  }

  return { clientId, clientSecret };
}
