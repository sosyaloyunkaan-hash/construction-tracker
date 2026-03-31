import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const floorId = req.nextUrl.searchParams.get('floorId');
  if (!floorId) return NextResponse.json({ error: 'floorId required' }, { status: 400 });

  const { rows } = await query(
    'SELECT * FROM rooms WHERE floor_id = $1 ORDER BY id',
    [Number(floorId)]
  );
  return NextResponse.json(rows);
}
