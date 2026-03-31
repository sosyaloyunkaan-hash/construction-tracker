import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const buildingId = req.nextUrl.searchParams.get('buildingId');
  if (!buildingId) return NextResponse.json({ error: 'buildingId required' }, { status: 400 });

  const { rows } = await query(
    'SELECT * FROM floors WHERE building_id = $1 ORDER BY floor_number',
    [Number(buildingId)]
  );
  return NextResponse.json(rows);
}
