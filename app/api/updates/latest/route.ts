import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const p = req.nextUrl.searchParams;
  const buildingId = p.get('buildingId');
  const floorId = p.get('floorId');
  const roomId = p.get('roomId');
  const disciplineId = p.get('disciplineId');
  const activityId = p.get('activityId');

  if (!buildingId || !floorId || !roomId || !disciplineId || !activityId) {
    return NextResponse.json({ error: 'All params required' }, { status: 400 });
  }

  const { rows } = await query(`
    SELECT u.*,
      e.name as engineer_name, e.initials, e.avatar_color,
      b.name as building_name, f.name as floor_name,
      r.name as room_name, d.name as discipline_name, a.name as activity_name
    FROM updates u
    JOIN engineers e ON e.id = u.engineer_id
    JOIN buildings b ON b.id = u.building_id
    JOIN floors f ON f.id = u.floor_id
    JOIN rooms r ON r.id = u.room_id
    JOIN disciplines d ON d.id = u.discipline_id
    JOIN activities a ON a.id = u.activity_id
    WHERE u.building_id = $1 AND u.floor_id = $2 AND u.room_id = $3
      AND u.discipline_id = $4 AND u.activity_id = $5
    ORDER BY u.created_at DESC
    LIMIT 1
  `, [Number(buildingId), Number(floorId), Number(roomId), Number(disciplineId), Number(activityId)]);

  return NextResponse.json(rows[0] || null);
}
