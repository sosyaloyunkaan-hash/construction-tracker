import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query, initDB } from '@/lib/db';
import { signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  await initDB();
  const { name, password } = await req.json();

  if (!name || !password) {
    return NextResponse.json({ error: 'Name and password required' }, { status: 400 });
  }

  const { rows } = await query('SELECT * FROM engineers WHERE name = $1', [name]);
  const engineer = rows[0];

  if (!engineer || !bcrypt.compareSync(password, engineer.password)) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = await signToken({
    id: engineer.id,
    name: engineer.name,
    initials: engineer.initials,
    avatar_color: engineer.avatar_color,
  });

  const res = NextResponse.json({ success: true });
  res.cookies.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
    path: '/',
  });
  return res;
}
