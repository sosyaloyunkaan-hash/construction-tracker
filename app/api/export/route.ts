import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get latest update per building × floor × room × discipline × activity
  const { rows } = await query(`
    SELECT
      b.name AS building,
      f.name AS floor,
      r.name AS room,
      d.name AS discipline,
      a.name AS activity,
      COALESCE(latest.status, 'notstarted') AS status,
      COALESCE(latest.progress, 0) AS progress,
      COALESCE(latest.remarks, '') AS remarks
    FROM disciplines d
    JOIN activities a ON a.discipline_id = d.id
    CROSS JOIN buildings b
    JOIN floors f ON f.building_id = b.id
    JOIN rooms r ON r.floor_id = f.id
    LEFT JOIN LATERAL (
      SELECT u.status, u.progress, u.remarks FROM updates u
      WHERE u.activity_id = a.id AND u.building_id = b.id
        AND u.floor_id = f.id AND u.room_id = r.id
      ORDER BY u.created_at DESC LIMIT 1
    ) latest ON true
    ORDER BY b.name, f.floor_number, r.id, d.id, a.id
  `);

  const statusLabel: Record<string, string> = {
    notstarted: 'Not Started',
    ongoing:    'Ongoing',
    completed:  'Completed',
    hold:       'Hold',
  };

  const sheetData = [
    ['Building', 'Floor', 'Room', 'Discipline', 'Activity', 'Status', 'Progress %', 'Remark'],
    ...rows.map(r => [
      r.building,
      r.floor,
      r.room,
      r.discipline,
      r.activity,
      statusLabel[r.status] || r.status,
      parseInt(r.progress),
      r.remarks,
    ]),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Column widths
  ws['!cols'] = [
    { wch: 14 }, // Building
    { wch: 14 }, // Floor
    { wch: 22 }, // Room
    { wch: 16 }, // Discipline
    { wch: 30 }, // Activity
    { wch: 14 }, // Status
    { wch: 12 }, // Progress %
    { wch: 40 }, // Remark
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Progress');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="site-progress-${today}.xlsx"`,
    },
  });
}
