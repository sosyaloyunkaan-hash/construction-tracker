import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Only export rows that have actual updates
  const { rows } = await query(`
    SELECT
      b.name AS building,
      f.name AS floor,
      r.name AS room,
      d.name AS discipline,
      a.name AS activity,
      u.status,
      u.progress,
      COALESCE(u.remarks, '') AS remarks
    FROM (
      SELECT DISTINCT ON (activity_id, building_id, floor_id, room_id)
        activity_id, building_id, floor_id, room_id, discipline_id,
        status, progress, remarks
      FROM updates
      ORDER BY activity_id, building_id, floor_id, room_id, created_at DESC
    ) u
    JOIN buildings b ON b.id = u.building_id
    JOIN floors f ON f.id = u.floor_id
    JOIN rooms r ON r.id = u.room_id
    JOIN disciplines d ON d.id = u.discipline_id
    JOIN activities a ON a.id = u.activity_id
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
