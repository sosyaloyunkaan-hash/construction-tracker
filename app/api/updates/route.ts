import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    ORDER BY u.created_at DESC
    LIMIT 200
  `);

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { buildingId, floorId, roomId, disciplineId, activityId, progress, isHold, remarks } = body;

  if (buildingId == null || floorId == null || roomId == null ||
      disciplineId == null || activityId == null || progress == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Check authorization
  const { rows: authRows } = await query(
    'SELECT 1 FROM engineer_disciplines WHERE engineer_id = $1 AND discipline_id = $2',
    [user.id, Number(disciplineId)]
  );
  if (authRows.length === 0) {
    return NextResponse.json({ error: 'Not authorized for this discipline' }, { status: 403 });
  }

  const prog = Math.max(0, Math.min(100, Number(progress)));
  let status: string;
  if (prog === 100) status = 'completed';
  else if (isHold) status = 'hold';
  else if (prog === 0) status = 'notstarted';
  else status = 'ongoing';

  const { rows } = await query(`
    INSERT INTO updates
      (engineer_id, building_id, floor_id, room_id, discipline_id, activity_id, status, progress, remarks)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id
  `, [user.id, Number(buildingId), Number(floorId), Number(roomId),
      Number(disciplineId), Number(activityId), status, prog, remarks || '']);

  const { rows: newRows } = await query(`
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
    WHERE u.id = $1
  `, [rows[0].id]);

  return NextResponse.json(newRows[0], { status: 201 });
}
