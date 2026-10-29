import { NextRequest, NextResponse } from 'next/server';
import { findUserById } from '@/lib/userStore';

export async function GET(req: NextRequest) {
  const sessionUserId = req.cookies.get('pf_session_user_id')?.value;
  let user = sessionUserId ? await findUserById(sessionUserId) : null;

  // Admin Direct Mode: Default to Admin user so no login is ever required
  if (!user) {
    user = {
      id: 'admin',
      username: 'admin',
      name: 'Admin',
      membershipTier: 'Administrator',
      createdAt: new Date().toISOString(),
    };
  }

  const response = NextResponse.json({
    loggedIn: true,
    user: {
      id: user.id || 'admin',
      username: user.username || 'admin',
      name: user.name || 'Admin',
      membershipTier: user.membershipTier || 'Administrator',
    },
  });

  // Ensure pf_session_user_id cookie is present for background requests
  if (!sessionUserId) {
    response.cookies.set('pf_session_user_id', 'admin', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}
