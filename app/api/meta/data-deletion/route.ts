import { NextRequest, NextResponse } from 'next/server';

/**
 * Meta User Data Deletion Callback endpoint
 * Reference: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/
 */
export async function POST(req: NextRequest) {
  try {
    const confirmationCode = 'del_' + Math.random().toString(36).substring(2, 12);
    const trackingUrl = `https://viralkamflow.vercel.app/data-deletion?code=${confirmationCode}`;

    // Meta expects a JSON response containing 'url' and 'confirmation_code'
    return NextResponse.json({
      url: trackingUrl,
      confirmation_code: confirmationCode,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to process data deletion callback' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    status: 'active',
    instructions_url: 'https://viralkamflow.vercel.app/data-deletion',
    message: 'Karmflow Meta data deletion endpoint is online and active.',
  });
}
