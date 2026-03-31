import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch all static data separately (no cross join)
  const [discRows, buildRows, floorRows, roomRows, updateRows] = await Promise.all([
    query(`SELECT d.id AS discipline_id, d.name AS discipline_name,
                  a.id AS activity_id, a.name AS activity_name
           FROM disciplines d JOIN activities a ON a.discipline_id = d.id
           ORDER BY d.id, a.id`),
    query(`SELECT * FROM buildings ORDER BY name`),
    query(`SELECT * FROM floors ORDER BY building_id, floor_number`),
    query(`SELECT * FROM rooms ORDER BY floor_id, id`),
    // Only latest update per unique combination
    query(`SELECT DISTINCT ON (activity_id, building_id, floor_id, room_id)
             activity_id, building_id, floor_id, room_id, progress, status
           FROM updates
           ORDER BY activity_id, building_id, floor_id, room_id, created_at DESC`),
  ]);

  // Index updates for fast lookup
  const updateIndex: Record<string, { progress: number; status: string }> = {};
  for (const u of updateRows.rows) {
    updateIndex[`${u.activity_id}-${u.building_id}-${u.floor_id}-${u.room_id}`] = {
      progress: parseInt(u.progress),
      status: u.status,
    };
  }

  // Index floors by building, rooms by floor
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

  // Group activities by discipline
  const discMap: Record<number, { discipline_id: number; discipline_name: string; activities: any[] }> = {};
  for (const row of discRows.rows) {
    if (!discMap[row.discipline_id]) {
      discMap[row.discipline_id] = { discipline_id: row.discipline_id, discipline_name: row.discipline_name, activities: [] };
    }

    const buildings = buildRows.rows.map(b => {
      const floors = (floorsByBuilding[b.id] || []).map(f => {
        const rooms = (roomsByFloor[f.id] || []).map(r => {
          const key = `${row.activity_id}-${b.id}-${f.id}-${r.id}`;
          const upd = updateIndex[key];
          return {
            room_id: r.id,
            room_name: r.name,
            room_progress: upd?.progress ?? 0,
            room_status: upd?.status ?? 'notstarted',
            has_update: !!upd,
          };
        });

        const totalRooms = rooms.length;
        const updatedRooms = rooms.filter(r => r.has_update).length;
        const floorProgress = totalRooms > 0
          ? Math.round(rooms.reduce((s, r) => s + r.room_progress, 0) / totalRooms)
          : 0;

        return {
          floor_id: f.id,
          floor_name: f.name,
          floor_number: f.floor_number,
          total_rooms: totalRooms,
          updated_rooms: updatedRooms,
          floor_progress: floorProgress,
          rooms,
        };
      });

      const buildingProgress = floors.length > 0
        ? Math.round(floors.reduce((s, f) => s + f.floor_progress, 0) / floors.length)
        : 0;

      return { building_id: b.id, building_name: b.name, building_progress: buildingProgress, floors };
    });

    const overallProgress = buildings.length > 0
      ? Math.round(buildings.reduce((s, b) => s + b.building_progress, 0) / buildings.length)
      : 0;

    discMap[row.discipline_id].activities.push({
      activity_id: row.activity_id,
      activity_name: row.activity_name,
      overall_progress: overallProgress,
      buildings,
    });
  }

  return NextResponse.json(Object.values(discMap));
}
