import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { requireProject } from '@/lib/project';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const scope = await requireProject();
  if (scope instanceof NextResponse) return scope;

  const { searchParams } = new URL(req.url);
  const buildingId  = Number(searchParams.get('buildingId'));
  const floorId     = Number(searchParams.get('floorId'));
  const roomId      = Number(searchParams.get('roomId'));
  const activityId  = Number(searchParams.get('activityId'));

  if (!buildingId || !floorId || !roomId || !activityId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const { rows } = await query(`
    SELECT c.id, c.message, c.created_at,
           e.name AS engineer_name, e.initials, e.avatar_color
    FROM comments c
    JOIN engineers e ON e.id = c.engineer_id
    WHERE c.building_id = $1 AND c.floor_id = $2
      AND c.room_id = $3 AND c.activity_id = $4 AND c.project_id = $5
    ORDER BY c.created_at ASC
  `, [buildingId, floorId, roomId, activityId, scope]);

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const scope = await requireProject();
  if (scope instanceof NextResponse) return scope;

  const { buildingId, floorId, roomId, activityId, message } = await req.json();

  if (!buildingId || !floorId || !roomId || !activityId || !message?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { rows: bOk } = await query(
    'SELECT 1 FROM buildings WHERE id = $1 AND project_id = $2',
    [Number(buildingId), scope]
  );
  if (bOk.length === 0) {
    return NextResponse.json({ error: 'Building is not in the selected project' }, { status: 400 });
  }

  const { rows } = await query(`
    INSERT INTO comments (engineer_id, project_id, building_id, floor_id, room_id, activity_id, message)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, message, created_at
  `, [user.id, scope, Number(buildingId), Number(floorId), Number(roomId), Number(activityId), message.trim()]);

  return NextResponse.json({
    ...rows[0],
    engineer_name: user.name,
    initials: user.initials,
    avatar_color: user.avatar_color,
  }, { status: 201 });
}
