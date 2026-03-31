import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get floor-level aggregates: avg progress across all rooms per activity×building×floor
  const { rows } = await query(`
    SELECT
      d.id AS discipline_id, d.name AS discipline_name,
      a.id AS activity_id, a.name AS activity_name,
      b.id AS building_id, b.name AS building_name,
      f.id AS floor_id, f.name AS floor_name, f.floor_number,
      COUNT(r.id) AS total_rooms,
      COUNT(latest.progress) AS updated_rooms,
      COALESCE(ROUND(AVG(COALESCE(latest.progress, 0))), 0) AS floor_progress
    FROM disciplines d
    JOIN activities a ON a.discipline_id = d.id
    CROSS JOIN buildings b
    JOIN floors f ON f.building_id = b.id
    JOIN rooms r ON r.floor_id = f.id
    LEFT JOIN LATERAL (
      SELECT u.progress FROM updates u
      WHERE u.activity_id = a.id AND u.building_id = b.id
        AND u.floor_id = f.id AND u.room_id = r.id
      ORDER BY u.created_at DESC LIMIT 1
    ) latest ON true
    GROUP BY d.id, d.name, a.id, a.name, b.id, b.name, f.id, f.name, f.floor_number
    ORDER BY d.id, a.id, b.name, f.floor_number
  `);

  // Nest: discipline > activity > building > floor
  const disciplineMap: Record<number, {
    discipline_id: number; discipline_name: string;
    activities: Record<number, {
      activity_id: number; activity_name: string;
      buildings: Record<number, {
        building_id: number; building_name: string;
        floors: { floor_id: number; floor_name: string; floor_number: number; total_rooms: number; updated_rooms: number; floor_progress: number }[];
      }>;
    }>;
  }> = {};

  for (const row of rows) {
    const dId = row.discipline_id;
    const aId = row.activity_id;
    const bId = row.building_id;

    if (!disciplineMap[dId]) {
      disciplineMap[dId] = { discipline_id: dId, discipline_name: row.discipline_name, activities: {} };
    }
    if (!disciplineMap[dId].activities[aId]) {
      disciplineMap[dId].activities[aId] = { activity_id: aId, activity_name: row.activity_name, buildings: {} };
    }
    if (!disciplineMap[dId].activities[aId].buildings[bId]) {
      disciplineMap[dId].activities[aId].buildings[bId] = { building_id: bId, building_name: row.building_name, floors: [] };
    }

    disciplineMap[dId].activities[aId].buildings[bId].floors.push({
      floor_id: row.floor_id,
      floor_name: row.floor_name,
      floor_number: row.floor_number,
      total_rooms: parseInt(row.total_rooms),
      updated_rooms: parseInt(row.updated_rooms),
      floor_progress: parseInt(row.floor_progress),
    });
  }

  // Convert to arrays and compute building/activity averages
  const result = Object.values(disciplineMap).map(disc => ({
    ...disc,
    activities: Object.values(disc.activities).map(act => {
      const buildings = Object.values(act.buildings).map(bldg => {
        const totalProgress = bldg.floors.reduce((s, f) => s + f.floor_progress, 0);
        const building_progress = Math.round(totalProgress / bldg.floors.length);
        return { ...bldg, building_progress };
      });
      const overall_progress = Math.round(
        buildings.reduce((s, b) => s + b.building_progress, 0) / buildings.length
      );
      return { ...act, buildings, overall_progress };
    }),
  }));

  return NextResponse.json(result);
}
