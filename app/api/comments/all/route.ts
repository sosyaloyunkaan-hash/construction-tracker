import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rows } = await query(`
    SELECT
      c.id,
      c.message,
      c.created_at,
      e.name  AS engineer_name,
      e.initials,
      e.avatar_color,
      b.name  AS building_name,
      f.name  AS floor_name,
      r.name  AS room_name,
      a.name  AS activity_name,
      d.name  AS discipline_name,
      c.building_id,
      c.floor_id,
      c.room_id,
      c.activity_id
    FROM comments c
    JOIN engineers  e ON e.id = c.engineer_id
    JOIN buildings  b ON b.id = c.building_id
    JOIN floors     f ON f.id = c.floor_id
    JOIN rooms      r ON r.id = c.room_id
    JOIN activities a ON a.id = c.activity_id
    JOIN disciplines d ON d.id = a.discipline_id
    ORDER BY c.created_at DESC
  `);

  return NextResponse.json(rows);
}
