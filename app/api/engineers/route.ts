import { NextResponse } from 'next/server';
import { query, initDB } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  await initDB();
  const { rows } = await query('SELECT name FROM engineers ORDER BY name');
  return NextResponse.json(rows);
}
