import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getPool } from '@/lib/db';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { buildingId, floorId, roomIds, disciplineId, activityId, progress, isHold, remarks } = await req.json();

  if (!buildingId || !floorId || !Array.isArray(roomIds) || roomIds.length === 0 ||
      !disciplineId || !activityId || progress == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const prog = Math.max(0, Math.min(100, Number(progress)));
  let status: string;
  if (prog === 100) status = 'completed';
  else if (isHold) status = 'hold';
  else if (prog === 0) status = 'notstarted';
  else status = 'ongoing';

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify authorization
    const { rows: authRows } = await client.query(
      'SELECT 1 FROM engineer_disciplines WHERE engineer_id = $1 AND discipline_id = $2',
      [user.id, Number(disciplineId)]
    );
    if (authRows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Not authorized for this discipline' }, { status: 403 });
    }

    // Insert one update per room
    const values: unknown[] = [];
    const placeholders: string[] = [];
    roomIds.forEach((roomId: number, i: number) => {
      const base = i * 9;
      placeholders.push(
        `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9})`
      );
      values.push(
        user.id, Number(buildingId), Number(floorId), Number(roomId),
        Number(disciplineId), Number(activityId), status, prog, remarks || ''
      );
    });

    await client.query(
      `INSERT INTO updates (engineer_id, building_id, floor_id, room_id, discipline_id, activity_id, status, progress, remarks)
       VALUES ${placeholders.join(',')}`,
      values
    );

    await client.query('COMMIT');
    return NextResponse.json({ success: true, count: roomIds.length }, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Bulk update failed:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
