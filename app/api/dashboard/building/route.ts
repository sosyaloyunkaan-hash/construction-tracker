import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [buildRows, floorRows, roomRows, actRows, updateRows] = await Promise.all([
    query(`SELECT id, name FROM buildings ORDER BY name`),
    query(`SELECT id, building_id, floor_number, name FROM floors ORDER BY building_id, floor_number`),
    query(`SELECT id, floor_id, name FROM rooms ORDER BY floor_id, id`),
    query(`
      SELECT a.id, a.name AS activity_name, d.name AS discipline_name
      FROM activities a JOIN disciplines d ON d.id = a.discipline_id
      ORDER BY d.id, a.id
    `),
    // Latest update per (activity, building, floor, room)
    query(`
      SELECT DISTINCT ON (activity_id, building_id, floor_id, room_id)
        activity_id, building_id, floor_id, room_id, progress, status
      FROM updates
      ORDER BY activity_id, building_id, floor_id, room_id, created_at DESC
    `),
  ]);

  // Index: building_id -> floor_id -> room_id -> activity_id -> { progress, status }
  type UpdStat = { progress: number; status: string };
  const updIndex: Record<number, Record<number, Record<number, Record<number, UpdStat>>>> = {};
  for (const u of updateRows.rows) {
    const { building_id: bId, floor_id: fId, room_id: rId, activity_id: aId } = u;
    if (!updIndex[bId]) updIndex[bId] = {};
    if (!updIndex[bId][fId]) updIndex[bId][fId] = {};
    if (!updIndex[bId][fId][rId]) updIndex[bId][fId][rId] = {};
    updIndex[bId][fId][rId][aId] = { progress: parseInt(u.progress), status: u.status };
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
        const roomUpdates = updIndex[b.id]?.[f.id]?.[r.id] ?? {};
        const activities = actRows.rows.map(a => {
          const upd = roomUpdates[a.id];
          return {
            activity_id: a.id,
            activity_name: a.activity_name,
            discipline_name: a.discipline_name,
            progress: upd?.progress ?? 0,
            status: upd?.status ?? 'notstarted',
            has_update: !!upd,
          };
        });

        const updated = activities.filter(a => a.has_update);
        const room_progress = updated.length > 0
          ? Math.round(updated.reduce((s, a) => s + a.progress, 0) / updated.length)
          : 0;

        return { room_id: r.id, room_name: r.name, room_progress, activities };
      });

      const activeRooms = rooms.filter(r => r.room_progress > 0);
      const floor_progress = activeRooms.length > 0
        ? Math.round(activeRooms.reduce((s, r) => s + r.room_progress, 0) / activeRooms.length)
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
