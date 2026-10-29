import { NextResponse } from 'next/server';
import {
  getCleanFacebookCredentials,
  getCleanInstagramCredentials,
  getCleanThreadsCredentials,
  getCleanGoogleCredentials,
} from '@/lib/oauthUrl';

/**
 * Server-side OAuth configuration check.
 * Strictly returns boolean status flags per independent platform.
 * NEVER returns raw secrets or API keys to the browser.
 */
export async function GET() {
  const fb = getCleanFacebookCredentials();
  const ig = getCleanInstagramCredentials();
  const th = getCleanThreadsCredentials();
  const yt = getCleanGoogleCredentials();

  const hasFacebook = Boolean(fb.clientId && fb.clientSecret);
  const hasInstagram = Boolean(ig.clientId && ig.clientSecret);
  const hasThreads = Boolean(th.clientId && th.clientSecret);
  const hasYouTube = Boolean(yt.clientId && yt.clientSecret);

  return NextResponse.json({
    configured: {
      facebook: hasFacebook,
      instagram: hasInstagram,
      threads: hasThreads,
      youtube: hasYouTube,
    },
    facebookConfigured: hasFacebook,
    instagramConfigured: hasInstagram,
    threadsConfigured: hasThreads,
    googleConfigured: hasYouTube,
  });
}
