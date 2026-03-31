import { NextRequest, NextResponse } from 'next/server';
import { query, initDB } from '@/lib/db';

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.RESET_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Drop all data and re-seed
  await query('DROP TABLE IF EXISTS updates');
  await query('DROP TABLE IF EXISTS rooms');
  await query('DROP TABLE IF EXISTS floors');
  await query('DROP TABLE IF EXISTS buildings');
  await query('DROP TABLE IF EXISTS engineer_disciplines');
  await query('DROP TABLE IF EXISTS engineers');
  await query('DROP TABLE IF EXISTS activities');
  await query('DROP TABLE IF EXISTS disciplines');

  await initDB();

  return NextResponse.json({ success: true, message: 'Database reset and re-seeded with new room data' });
}
