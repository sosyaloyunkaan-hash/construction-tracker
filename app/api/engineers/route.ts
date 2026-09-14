import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { rows } = await query(
    "SELECT name FROM engineers WHERE name <> 'CSV Import' ORDER BY name"
  );
  return NextResponse.json(rows);
}
