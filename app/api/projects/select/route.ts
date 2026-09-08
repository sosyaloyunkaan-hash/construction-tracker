import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { PROJECT_COOKIE } from '@/lib/projects';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { projectId } = await req.json();
  const id = Number(projectId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid projectId' }, { status: 400 });
  }

  const { rows } = await query('SELECT id, code, name FROM projects WHERE id = $1', [id]);
  if (!rows.length) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const res = NextResponse.json({ success: true, project: rows[0] });
  res.cookies.set(PROJECT_COOKIE, String(id), {
    httpOnly: false, // read client-side too; contains only a project id
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  });
  return res;
}
