import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Room-level: latest progress per activity × building × floor × room
  const { rows } = await query(`
    SELECT
      d.id AS discipline_id, d.name AS discipline_name,
      a.id AS activity_id, a.name AS activity_name,
      b.id AS building_id, b.name AS building_name,
      f.id AS floor_id, f.name AS floor_name, f.floor_number,
      r.id AS room_id, r.name AS room_name,
      COALESCE(latest.progress, 0) AS room_progress,
      COALESCE(latest.status, 'notstarted') AS room_status,
      CASE WHEN latest.progress IS NOT NULL THEN 1 ELSE 0 END AS has_update
    FROM disciplines d
    JOIN activities a ON a.discipline_id = d.id
    CROSS JOIN buildings b
    JOIN floors f ON f.building_id = b.id
    JOIN rooms r ON r.floor_id = f.id
    LEFT JOIN LATERAL (
      SELECT u.progress, u.status FROM updates u
      WHERE u.activity_id = a.id AND u.building_id = b.id
        AND u.floor_id = f.id AND u.room_id = r.id
      ORDER BY u.created_at DESC LIMIT 1
    ) latest ON true
    ORDER BY d.id, a.id, b.name, f.floor_number, r.id
  `);

  // Nest: discipline > activity > building > floor > room
  const disciplineMap: Record<number, any> = {};

  for (const row of rows) {
    const dId = row.discipline_id;
    const aId = row.activity_id;
    const bId = row.building_id;
    const fId = row.floor_id;

    if (!disciplineMap[dId]) {
      disciplineMap[dId] = { discipline_id: dId, discipline_name: row.discipline_name, activities: {} };
    }
    const disc = disciplineMap[dId];

    if (!disc.activities[aId]) {
      disc.activities[aId] = { activity_id: aId, activity_name: row.activity_name, buildings: {} };
    }
    const act = disc.activities[aId];

    if (!act.buildings[bId]) {
      act.buildings[bId] = { building_id: bId, building_name: row.building_name, floors: {} };
    }
    const bldg = act.buildings[bId];

    if (!bldg.floors[fId]) {
      bldg.floors[fId] = {
        floor_id: fId, floor_name: row.floor_name, floor_number: parseInt(row.floor_number), rooms: []
      };
    }

    bldg.floors[fId].rooms.push({
      room_id: row.room_id,
      room_name: row.room_name,
      room_progress: parseInt(row.room_progress),
      room_status: row.room_status,
      has_update: parseInt(row.has_update) === 1,
    });
  }

  // Aggregate upward
  const result = Object.values(disciplineMap).map((disc: any) => ({
    ...disc,
    activities: Object.values(disc.activities).map((act: any) => {
      const buildings = Object.values(act.buildings).map((bldg: any) => {
        const floors = Object.values(bldg.floors).map((floor: any) => {
          const totalRooms = floor.rooms.length;
          const updatedRooms = floor.rooms.filter((r: any) => r.has_update).length;
          const floorProgress = Math.round(
            floor.rooms.reduce((s: number, r: any) => s + r.room_progress, 0) / totalRooms
          );
          return { ...floor, total_rooms: totalRooms, updated_rooms: updatedRooms, floor_progress: floorProgress };
        }).sort((a: any, b: any) => a.floor_number - b.floor_number);

        const buildingProgress = Math.round(
          floors.reduce((s: number, f: any) => s + f.floor_progress, 0) / floors.length
        );
        return { ...bldg, floors, building_progress: buildingProgress };
      });

      const overallProgress = Math.round(
        buildings.reduce((s: number, b: any) => s + b.building_progress, 0) / buildings.length
      );
      return { ...act, buildings, overall_progress: overallProgress };
    }),
  }));

  return NextResponse.json(result);
}
