import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const disciplineId = req.nextUrl.searchParams.get('disciplineId');
  if (!disciplineId) return NextResponse.json({ error: 'disciplineId required' }, { status: 400 });

  const { rows } = await query(
    'SELECT * FROM activities WHERE discipline_id = $1 ORDER BY id',
    [Number(disciplineId)]
  );
  return NextResponse.json(rows);
}
