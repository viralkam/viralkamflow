import { NextRequest, NextResponse } from 'next/server';
import { getServerRules, saveServerRules, addServerRule, updateServerRule, deleteServerRule } from '@/lib/autoReplyStore';

export async function GET() {
  const rules = await getServerRules();
  return NextResponse.json({ success: true, rules });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.keyword || !body.dmMessage) {
      return NextResponse.json({ error: 'Keyword and dmMessage are required.' }, { status: 400 });
    }

    const newRule = {
      id: body.id || `rule-${Date.now()}`,
      platform: body.platform || 'All',
      keyword: body.keyword.trim().toUpperCase(),
      dmMessage: body.dmMessage.trim(),
      commentReply: body.commentReply?.trim() || undefined,
      isActive: body.isActive !== undefined ? body.isActive : true,
      triggerCount: body.triggerCount || 0,
      createdAt: body.createdAt || new Date().toISOString(),
      targetPostId: body.targetPostId || undefined,
      targetPostTitle: body.targetPostTitle || undefined,
      requireFollower: Boolean(body.requireFollower),
      followerOnlyLink: body.followerOnlyLink?.trim() || undefined,
      followerDmMessage: body.followerDmMessage?.trim() || undefined,
      nonFollowerDmMessage: body.nonFollowerDmMessage?.trim() || undefined,
      nonFollowerCommentReply: body.nonFollowerCommentReply?.trim() || undefined,
    };

    await addServerRule(newRule);
    return NextResponse.json({ success: true, rule: newRule });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: 'Rule ID is required.' }, { status: 400 });
    }
    const updated = await updateServerRule(body.id, body);
    return NextResponse.json({ success: true, rule: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Rule ID is required.' }, { status: 400 });
  }
  await deleteServerRule(id);
  return NextResponse.json({ success: true });
}
