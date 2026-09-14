import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth';
import { query, toCsv, statusLabel, PROJECT_CSV_HEADERS } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Download the current state of a project as a CSV that can be edited and posted
 * back to the import endpoint.
 * - Empty project        -> header row only.
 * - Structure, no updates -> one row per room, status columns blank.
 * - With updates          -> one row per (room, discipline, activity) latest update,
 *                            plus a bare row for any room that has no updates.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await verifyAdminToken())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = parseInt(params.id, 10);
  if (isNaN(projectId)) {
    return NextResponse.json({ error: 'Invalid project id' }, { status: 400 });
  }
  const { rows: proj } = await query('SELECT code, name FROM projects WHERE id = $1', [projectId]);
  if (!proj.length) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const { rows } = await query(`
    WITH latest AS (
      SELECT DISTINCT ON (u.room_id, u.discipline_id, u.activity_id)
        u.room_id, u.discipline_id, u.activity_id, u.progress, u.status, u.remarks
      FROM updates u
      WHERE u.project_id = $1
      ORDER BY u.room_id, u.discipline_id, u.activity_id, u.created_at DESC
    )
    SELECT
      b.name AS building, f.name AS floor, f.floor_number, r.id AS room_id, r.name AS room,
      d.name AS discipline, a.name AS activity,
      l.progress, l.status, l.remarks
    FROM rooms r
    JOIN floors f    ON f.id = r.floor_id
    JOIN buildings b ON b.id = f.building_id
    LEFT JOIN latest l      ON l.room_id = r.id
    LEFT JOIN disciplines d ON d.id = l.discipline_id
    LEFT JOIN activities a  ON a.id = l.activity_id
    WHERE b.project_id = $1
    ORDER BY b.name, f.floor_number, r.id, d.name NULLS FIRST, a.name NULLS FIRST
  `, [projectId]);

  const data = rows.map(r => [
    r.building,
    r.floor,
    r.room,
    r.discipline ?? '',
    r.activity ?? '',
    r.progress ?? '',
    r.status ? statusLabel(r.status) : '',
    r.remarks ?? '',
  ]);

  const csv = toCsv(PROJECT_CSV_HEADERS, data);
  const safe = `${proj[0].code} - ${proj[0].name}`.replace(/[^\w .-]+/g, '_');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safe}.csv"`,
    },
  });
}
