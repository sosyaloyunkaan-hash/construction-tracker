import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';

const UPDATE_SELECT = `
  SELECT u.*,
    e.name AS engineer_name, e.initials, e.avatar_color,
    b.name AS building_name, f.name AS floor_name,
    r.name AS room_name, d.name AS discipline_name, a.name AS activity_name
  FROM updates u
  JOIN engineers e ON e.id = u.engineer_id
  JOIN buildings b ON b.id = u.building_id
  JOIN floors   f ON f.id = u.floor_id
  JOIN rooms    r ON r.id = u.room_id
  JOIN disciplines d ON d.id = u.discipline_id
  JOIN activities  a ON a.id = u.activity_id
`;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rows } = await query(
    UPDATE_SELECT + ' ORDER BY u.created_at DESC LIMIT 500'
  );
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

  // INSERT and fetch full record in one round-trip using a CTE
  const { rows } = await query(`
    WITH inserted AS (
      INSERT INTO updates
        (engineer_id, building_id, floor_id, room_id, discipline_id, activity_id, status, progress, remarks)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    )
    ${UPDATE_SELECT.replace('FROM updates u', 'FROM inserted u')}
  `, [user.id, Number(buildingId), Number(floorId), Number(roomId),
      Number(disciplineId), Number(activityId), status, prog, remarks || '']);

  return NextResponse.json(rows[0], { status: 201 });
}
