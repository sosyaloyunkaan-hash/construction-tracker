import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { requireProject } from '@/lib/project';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

const BUILDING_DASHBOARD_CACHE_TTL_MS = 15_000;
const buildingDashboardCache = new Map<string, { expiresAt: number; data: unknown }>();
const buildingDashboardInFlight = new Map<string, Promise<unknown>>();

async function computeBuildingDashboard(projectId: number) {
  const [buildRows, floorRows, roomRows, actRows, updateRows] = await Promise.all([
    query(`SELECT id, name FROM buildings WHERE project_id = $1 ORDER BY name`, [projectId]),
    query(`
      SELECT f.id, f.building_id, f.floor_number, f.name
      FROM floors f JOIN buildings b ON b.id = f.building_id
      WHERE b.project_id = $1
      ORDER BY f.building_id, f.floor_number
    `, [projectId]),
    query(`
      SELECT r.id, r.floor_id, r.name
      FROM rooms r
      JOIN floors f ON f.id = r.floor_id
      JOIN buildings b ON b.id = f.building_id
      WHERE b.project_id = $1
      ORDER BY r.floor_id, r.id
    `, [projectId]),
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
      WHERE project_id = $1
      ORDER BY activity_id, building_id, floor_id, room_id, created_at DESC
    `, [projectId]),
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

  return buildings;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const scope = await requireProject();
  if (scope instanceof NextResponse) return scope;
  const cacheKey = `building-dashboard:${scope}`;

  const cached = buildingDashboardCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(cached.data);
  }

  // Coalesce concurrent misses onto a single computation.
  let inFlight = buildingDashboardInFlight.get(cacheKey);
  if (!inFlight) {
    inFlight = computeBuildingDashboard(scope)
      .then((data) => {
        buildingDashboardCache.set(cacheKey, { expiresAt: Date.now() + BUILDING_DASHBOARD_CACHE_TTL_MS, data });
        return data;
      })
      .finally(() => {
        buildingDashboardInFlight.delete(cacheKey);
      });
    buildingDashboardInFlight.set(cacheKey, inFlight);
  }

  try {
    const data = await inFlight;
    return NextResponse.json(data);
  } catch (err) {
    console.error('building dashboard failed:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
