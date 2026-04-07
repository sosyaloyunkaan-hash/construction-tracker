import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Single query: aggregate progress per (discipline, activity, building, floor) in DB
  const [discActRows, buildRows, floorRows, roomCountRows, updateRows] = await Promise.all([
    query(`
      SELECT d.id AS discipline_id, d.name AS discipline_name,
             a.id AS activity_id, a.name AS activity_name
      FROM disciplines d JOIN activities a ON a.discipline_id = d.id
      ORDER BY d.id, a.id
    `),
    query(`SELECT id, name FROM buildings ORDER BY name`),
    query(`SELECT id, building_id, floor_number, name FROM floors ORDER BY building_id, floor_number`),
    // Total rooms per floor
    query(`SELECT floor_id, COUNT(*) AS total FROM rooms GROUP BY floor_id`),
    // Latest update per (activity, building, floor, room) — aggregated to floor level
    query(`
      WITH latest AS (
        SELECT DISTINCT ON (activity_id, building_id, floor_id, room_id)
          activity_id, building_id, floor_id, room_id, progress, status
        FROM updates
        ORDER BY activity_id, building_id, floor_id, room_id, created_at DESC
      )
      SELECT activity_id, building_id, floor_id,
             COUNT(*) AS updated_rooms,
             ROUND(AVG(progress)) AS floor_progress
      FROM latest
      GROUP BY activity_id, building_id, floor_id
    `),
  ]);

  // Build indexes
  const totalRoomsByFloor: Record<number, number> = {};
  for (const r of roomCountRows.rows) totalRoomsByFloor[r.floor_id] = parseInt(r.total);

  const floorsByBuilding: Record<number, typeof floorRows.rows> = {};
  for (const f of floorRows.rows) {
    if (!floorsByBuilding[f.building_id]) floorsByBuilding[f.building_id] = [];
    floorsByBuilding[f.building_id].push(f);
  }

  // Index: activity_id -> building_id -> floor_id -> { updated_rooms, floor_progress }
  type FloorStat = { updated_rooms: number; floor_progress: number };
  const statIndex: Record<number, Record<number, Record<number, FloorStat>>> = {};
  for (const r of updateRows.rows) {
    const aId = r.activity_id, bId = r.building_id, fId = r.floor_id;
    if (!statIndex[aId]) statIndex[aId] = {};
    if (!statIndex[aId][bId]) statIndex[aId][bId] = {};
    statIndex[aId][bId][fId] = {
      updated_rooms: parseInt(r.updated_rooms),
      floor_progress: parseInt(r.floor_progress),
    };
  }

  // Assemble response
  const discMap: Record<number, { discipline_id: number; discipline_name: string; activities: unknown[] }> = {};

  for (const row of discActRows.rows) {
    if (!discMap[row.discipline_id]) {
      discMap[row.discipline_id] = {
        discipline_id: row.discipline_id,
        discipline_name: row.discipline_name,
        activities: [],
      };
    }

    const buildings = buildRows.rows.map(b => {
      const floors = (floorsByBuilding[b.id] || []).map(f => {
        const stat = statIndex[row.activity_id]?.[b.id]?.[f.id];
        const total = totalRoomsByFloor[f.id] || 0;
        return {
          floor_id: f.id,
          floor_name: f.name,
          floor_number: f.floor_number,
          total_rooms: total,
          updated_rooms: stat?.updated_rooms ?? 0,
          floor_progress: stat?.floor_progress ?? 0,
        };
      });

      const activeFl = floors.filter(f => f.floor_progress > 0);
      const building_progress = activeFl.length > 0
        ? Math.round(activeFl.reduce((s, f) => s + f.floor_progress, 0) / activeFl.length)
        : 0;

      return { building_id: b.id, building_name: b.name, building_progress, floors };
    });

    const activeB = buildings.filter(b => b.building_progress > 0);
    const overall_progress = activeB.length > 0
      ? Math.round(activeB.reduce((s, b) => s + b.building_progress, 0) / activeB.length)
      : 0;

    discMap[row.discipline_id].activities.push({
      activity_id: row.activity_id,
      activity_name: row.activity_name,
      overall_progress,
      buildings,
    });
  }

  return NextResponse.json(Object.values(discMap));
}
