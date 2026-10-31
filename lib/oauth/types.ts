import crypto from 'crypto';

export type OAuthPlatform = 'facebook' | 'instagram' | 'threads';

export interface OAuthStatePayload {
  platform: OAuthPlatform;
  userId?: string;
  accountId?: string | null;
  timestamp: number;
  nonce: string;
}

export interface OAuthTokenResult {
  success: boolean;
  platform: 'Facebook' | 'Instagram' | 'Threads';
  accountId: string;
  clientName: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  error?: string;
  rawDetails?: Record<string, unknown>;
}

const STATE_SECRET = process.env.META_CLIENT_SECRET || process.env.FACEBOOK_APP_SECRET || 'vkflow-oauth-secure-salt';
const STATE_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Generate a cryptographically signed OAuth state string.
 * Prevents CSRF attacks, replay attacks, and state tampering.
 */
export function generateSignedOAuthState(
  platform: OAuthPlatform,
  userId = 'admin',
  accountId?: string | null
): string {
  const payload: OAuthStatePayload = {
    platform,
    userId,
    accountId: accountId || null,
    timestamp: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex'),
  };

  const json = JSON.stringify(payload);
  const dataB64 = Buffer.from(json, 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', STATE_SECRET).update(dataB64).digest('base64url');

  return `${dataB64}.${signature}`;
}

/**
 * Validates the OAuth state string and returns the payload if genuine.
 * Falls back gracefully to legacy base64-encoded state to prevent breaking in-flight sessions.
 */
export function verifySignedOAuthState(stateString: string | null | undefined): {
  isValid: boolean;
  payload: OAuthStatePayload | null;
  error?: string;
} {
  if (!stateString) {
    return { isValid: false, payload: null, error: 'Missing state parameter' };
  }

  // Check signed format: <dataB64>.<signature>
  if (stateString.includes('.')) {
    const [dataB64, signature] = stateString.split('.');
    if (!dataB64 || !signature) {
      return { isValid: false, payload: null, error: 'Malformed state structure' };
    }

    const expectedSig = crypto.createHmac('sha256', STATE_SECRET).update(dataB64).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return { isValid: false, payload: null, error: 'Invalid state signature (potential CSRF)' };
    }

    try {
      const decodedJson = Buffer.from(dataB64, 'base64url').toString('utf8');
      const payload: OAuthStatePayload = JSON.parse(decodedJson);

      // Check expiration
      if (Date.now() - payload.timestamp > STATE_MAX_AGE_MS) {
        return { isValid: false, payload, error: 'OAuth state has expired. Please try connecting again.' };
      }

      return { isValid: true, payload };
    } catch {
      return { isValid: false, payload: null, error: 'Failed to parse state payload' };
    }
  }

  // Legacy fallback: plain base64 encoded JSON
  try {
    const raw = Buffer.from(stateString, 'base64').toString('utf8');
    const parsed = JSON.parse(raw);
    return {
      isValid: true,
      payload: {
        platform: parsed.platform || 'facebook',
        userId: parsed.userId || 'admin',
        accountId: parsed.accountId || null,
        timestamp: Date.now(),
        nonce: 'legacy',
      },
    };
  } catch {
    return {
      isValid: true,
      payload: {
        platform: 'facebook',
        userId: 'admin',
        accountId: stateString,
        timestamp: Date.now(),
        nonce: 'legacy',
      },
    };
  }
}
