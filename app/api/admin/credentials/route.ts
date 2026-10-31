import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  getCleanFacebookCredentials,
  getCleanInstagramCredentials,
  getCleanThreadsCredentials,
  getFacebookOAuthRedirectUri,
  getInstagramOAuthRedirectUri,
  getThreadsOAuthRedirectUri,
  readEnvKey,
} from '@/lib/oauthUrl';

export const dynamic = 'force-dynamic';

/**
 * Admin Credentials Management Route
 * 
 * Inspects and safely updates environment configurations for:
 * - Meta App (META_CLIENT_ID / META_CLIENT_SECRET)
 * - Instagram Unified Login (INSTAGRAM_CONFIG_ID)
 * - Threads App (THREADS_APP_ID / THREADS_APP_SECRET)
 */
export async function GET() {
  const fb = getCleanFacebookCredentials();
  const ig = getCleanInstagramCredentials();
  const th = getCleanThreadsCredentials();

  return NextResponse.json({
    facebook: {
      appId: fb.clientId || '',
      hasSecret: Boolean(fb.clientSecret),
      redirectUri: getFacebookOAuthRedirectUri(),
    },
    instagram: {
      appId: ig.clientId || '',
      hasSecret: Boolean(ig.clientSecret),
      configId: ig.configId || '',
      redirectUri: getInstagramOAuthRedirectUri(),
    },
    threads: {
      appId: th.clientId || '',
      hasSecret: Boolean(th.clientSecret),
      redirectUri: getThreadsOAuthRedirectUri(),
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const envPath = path.join(process.cwd(), '.env.local');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

    const updateEnvVar = (key: string, value: string | undefined) => {
      if (value === undefined || value === null) return;
      const cleanVal = value.trim();
      const regex = new RegExp(`^${key}\\s*=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${cleanVal}`);
      } else {
        envContent += `\n${key}=${cleanVal}`;
      }
      process.env[key] = cleanVal;
    };

    // Meta App / Facebook
    if (body.metaAppId || body.facebookAppId) {
      const val = body.metaAppId || body.facebookAppId;
      updateEnvVar('META_CLIENT_ID', val);
      updateEnvVar('FACEBOOK_APP_ID', val);
    }
    if (body.metaAppSecret || body.facebookAppSecret) {
      const val = body.metaAppSecret || body.facebookAppSecret;
      updateEnvVar('META_CLIENT_SECRET', val);
      updateEnvVar('FACEBOOK_APP_SECRET', val);
    }

    // Instagram Unified Login Configuration ID
    if (body.instagramConfigId !== undefined) {
      updateEnvVar('INSTAGRAM_CONFIG_ID', body.instagramConfigId);
    }

    // Threads App
    if (body.threadsAppId) {
      updateEnvVar('THREADS_APP_ID', body.threadsAppId);
    }
    if (body.threadsAppSecret) {
      updateEnvVar('THREADS_APP_SECRET', body.threadsAppSecret);
    }

    fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');

    return NextResponse.json({
      success: true,
      message: 'Credentials updated successfully in .env.local!',
    });
  } catch (err: any) {
    console.error('[Admin Credentials Update Error]:', err);
    return NextResponse.json({ error: err.message || 'Failed to update credentials' }, { status: 500 });
  }
}
