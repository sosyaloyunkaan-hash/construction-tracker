import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [discRows, actRows, buildRows, floorRows, roomRows, updateRows] = await Promise.all([
    query(`SELECT id, name FROM disciplines ORDER BY id`),
    query(`SELECT id, name, discipline_id FROM activities ORDER BY discipline_id, id`),
    query(`SELECT * FROM buildings ORDER BY name`),
    query(`SELECT * FROM floors ORDER BY building_id, floor_number`),
    query(`SELECT * FROM rooms ORDER BY floor_id, id`),
    query(`SELECT DISTINCT ON (activity_id, building_id, floor_id, room_id)
             activity_id, building_id, floor_id, room_id, progress, status
           FROM updates
           ORDER BY activity_id, building_id, floor_id, room_id, created_at DESC`),
  ]);

  // Indexes
  const discById: Record<number, string> = {};
  for (const d of discRows.rows) discById[d.id] = d.name;

  const updateIndex: Record<string, { progress: number; status: string }> = {};
  for (const u of updateRows.rows) {
    updateIndex[`${u.activity_id}-${u.building_id}-${u.floor_id}-${u.room_id}`] = {
      progress: parseInt(u.progress),
      status: u.status,
    };
  }

  const floorsByBuilding: Record<number, typeof floorRows.rows> = {};
  for (const f of floorRows.rows) {
    if (!floorsByBuilding[f.building_id]) floorsByBuilding[f.building_id] = [];
    floorsByBuilding[f.building_id].push(f);
  }

  const roomsByFloor: Record<number, typeof roomRows.rows> = {};
  for (const r of roomRows.rows) {
    if (!roomsByFloor[r.floor_id]) roomsByFloor[r.floor_id] = [];
    roomsByFloor[r.floor_id].push(r);
  }

  const buildings = buildRows.rows.map(b => {
    const floors = (floorsByBuilding[b.id] || []).map(f => {
      const rooms = (roomsByFloor[f.id] || []).map(r => {
        const activities = actRows.rows.map(a => {
          const key = `${a.id}-${b.id}-${f.id}-${r.id}`;
          const upd = updateIndex[key];
          return {
            activity_id: a.id,
            activity_name: a.name,
            discipline_name: discById[a.discipline_id] || '',
            progress: upd?.progress ?? 0,
            status: upd?.status ?? 'notstarted',
            has_update: !!upd,
          };
        });

        const updatedActivities = activities.filter(a => a.has_update);
        const room_progress = updatedActivities.length > 0
          ? Math.round(updatedActivities.reduce((s, a) => s + a.progress, 0) / updatedActivities.length)
          : 0;

        return { room_id: r.id, room_name: r.name, room_progress, activities };
      });

      const updatedRooms = rooms.filter(r => r.room_progress > 0);
      const floor_progress = updatedRooms.length > 0
        ? Math.round(updatedRooms.reduce((s, r) => s + r.room_progress, 0) / updatedRooms.length)
        : 0;

      return { floor_id: f.id, floor_name: f.name, floor_progress, rooms };
    });

    const activeFl = floors.filter(f => f.floor_progress > 0);
    const building_progress = activeFl.length > 0
      ? Math.round(activeFl.reduce((s, f) => s + f.floor_progress, 0) / activeFl.length)
      : 0;

    return { building_id: b.id, building_name: b.name, building_progress, floors };
  });

  return NextResponse.json(buildings);
}
