import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  getCleanFacebookCredentials,
  getCleanInstagramCredentials,
  getCleanThreadsCredentials,
} from '@/lib/oauthUrl';

/**
 * Admin Credentials Management Route
 * 
 * Allows Admin to view and update App IDs and Secrets for:
 * - Facebook
 * - Instagram
 * - Threads
 */
export async function GET() {
  const fb = getCleanFacebookCredentials();
  const ig = getCleanInstagramCredentials();
  const th = getCleanThreadsCredentials();

  return NextResponse.json({
    facebook: {
      appId: fb.clientId || '',
      hasSecret: Boolean(fb.clientSecret),
    },
    instagram: {
      appId: ig.clientId || '',
      hasSecret: Boolean(ig.clientSecret),
    },
    threads: {
      appId: th.clientId || '',
      hasSecret: Boolean(th.clientSecret),
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

    if (body.facebookAppId) updateEnvVar('FACEBOOK_APP_ID', body.facebookAppId);
    if (body.facebookAppSecret) updateEnvVar('FACEBOOK_APP_SECRET', body.facebookAppSecret);

    if (body.instagramAppId) updateEnvVar('INSTAGRAM_APP_ID', body.instagramAppId);
    if (body.instagramAppSecret) updateEnvVar('INSTAGRAM_APP_SECRET', body.instagramAppSecret);

    if (body.threadsAppId) updateEnvVar('THREADS_APP_ID', body.threadsAppId);
    if (body.threadsAppSecret) updateEnvVar('THREADS_APP_SECRET', body.threadsAppSecret);

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
