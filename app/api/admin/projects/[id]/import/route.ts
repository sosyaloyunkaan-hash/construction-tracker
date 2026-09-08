import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth';
import { query, parseRoomCsv, importRoomStructure } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST a "Building,Floor,Room" CSV to populate a project's room structure.
 * Body is the raw CSV text (Content-Type text/csv or text/plain), or multipart
 * form-data with a `file` field. Re-runnable — only missing rows are added.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await verifyAdminToken())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = parseInt(params.id, 10);
  if (isNaN(projectId)) {
    return NextResponse.json({ error: 'Invalid project id' }, { status: 400 });
  }
  const { rows: proj } = await query('SELECT 1 FROM projects WHERE id = $1', [projectId]);
  if (!proj.length) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  let csv = '';
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('file');
    if (file && typeof file !== 'string') csv = await file.text();
  } else {
    csv = await request.text();
  }

  if (!csv.trim()) {
    return NextResponse.json({ error: 'Empty CSV' }, { status: 400 });
  }

  const structure = parseRoomCsv(csv);
  const buildingCount = Object.keys(structure).length;
  if (buildingCount === 0) {
    return NextResponse.json(
      { error: 'No valid rows. Expected "Building,Floor,Room" columns.' },
      { status: 400 }
    );
  }

  try {
    const result = await importRoomStructure(projectId, structure);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error('CSV import failed:', err);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
