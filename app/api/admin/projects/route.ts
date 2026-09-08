import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await verifyAdminToken())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { rows } = await query(`
    SELECT
      p.id, p.code, p.name,
      (SELECT COUNT(*)::int FROM buildings b WHERE b.project_id = p.id) AS buildings,
      (SELECT COUNT(*)::int FROM floors f
         JOIN buildings b ON b.id = f.building_id WHERE b.project_id = p.id) AS floors,
      (SELECT COUNT(*)::int FROM rooms r
         JOIN floors f ON f.id = r.floor_id
         JOIN buildings b ON b.id = f.building_id WHERE b.project_id = p.id) AS rooms,
      (SELECT COUNT(*)::int FROM updates u WHERE u.project_id = p.id) AS updates
    FROM projects p
    ORDER BY p.code
  `);
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  if (!(await verifyAdminToken())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { code, name } = await request.json();
  if (!code?.trim() || !name?.trim()) {
    return NextResponse.json({ error: 'code and name are required' }, { status: 400 });
  }

  const { rows: existing } = await query('SELECT 1 FROM projects WHERE code = $1', [code.trim()]);
  if (existing.length) {
    return NextResponse.json({ error: 'A project with that code already exists' }, { status: 409 });
  }

  const { rows } = await query(
    'INSERT INTO projects (code, name) VALUES ($1, $2) RETURNING id, code, name',
    [code.trim(), name.trim()]
  );
  return NextResponse.json(rows[0], { status: 201 });
}
