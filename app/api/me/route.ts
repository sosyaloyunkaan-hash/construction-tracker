import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rows } = await query(`
    SELECT d.id, d.name
    FROM disciplines d
    JOIN engineer_disciplines ed ON ed.discipline_id = d.id
    WHERE ed.engineer_id = $1
    ORDER BY d.id
  `, [user.id]);

  return NextResponse.json({ ...user, disciplines: rows });
}
