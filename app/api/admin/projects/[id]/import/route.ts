import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth';
import { query, parseProjectCsv, importRoomStructure, applyImportedUpdates } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST an exported project CSV to (re)populate a project.
 * Columns: Building,Floor,Room[,Discipline,Activity,Progress,Status,Remarks].
 * - Building/Floor/Room always upsert the room structure (only missing rows added).
 * - Rows that also carry Discipline + Activity + Progress append a status update.
 * Body is raw CSV text, or multipart form-data with a `file` field.
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

  const { structure, updates } = parseProjectCsv(csv);
  if (Object.keys(structure).length === 0) {
    return NextResponse.json(
      { error: 'No valid rows. Expected at least Building,Floor,Room columns.' },
      { status: 400 }
    );
  }

  try {
    const s = await importRoomStructure(projectId, structure);
    const u = await applyImportedUpdates(projectId, updates);
    return NextResponse.json({ success: true, ...s, ...u });
  } catch (err) {
    console.error('CSV import failed:', err);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
