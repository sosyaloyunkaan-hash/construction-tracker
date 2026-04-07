import { NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const isAdmin = await verifyAdminToken();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Per-engineer daily update counts for the last 14 days
  const { rows: daily } = await query(`
    SELECT
      e.id AS engineer_id,
      e.name,
      e.initials,
      e.avatar_color,
      DATE(u.created_at AT TIME ZONE 'UTC') AS day,
      COUNT(*) AS count
    FROM engineers e
    LEFT JOIN updates u ON u.engineer_id = e.id
      AND u.created_at >= NOW() - INTERVAL '14 days'
    GROUP BY e.id, e.name, e.initials, e.avatar_color, day
    ORDER BY e.name, day
  `);

  // Build date range (last 14 days)
  const dates: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  // Group by engineer
  const engineerMap: Record<number, {
    engineer_id: number;
    name: string;
    initials: string;
    avatar_color: string;
    daily: Record<string, number>;
  }> = {};

  for (const row of daily) {
    if (!engineerMap[row.engineer_id]) {
      engineerMap[row.engineer_id] = {
        engineer_id: row.engineer_id,
        name: row.name,
        initials: row.initials,
        avatar_color: row.avatar_color,
        daily: {},
      };
    }
    if (row.day) {
      engineerMap[row.engineer_id].daily[row.day.toISOString().slice(0, 10)] = parseInt(row.count);
    }
  }

  const engineers = Object.values(engineerMap).map(eng => ({
    engineer_id: eng.engineer_id,
    name: eng.name,
    initials: eng.initials,
    avatar_color: eng.avatar_color,
    daily_counts: dates.map(date => ({
      date,
      count: eng.daily[date] ?? 0,
    })),
    total_14d: Object.values(eng.daily).reduce((s, c) => s + c, 0),
    today: eng.daily[dates[dates.length - 1]] ?? 0,
  }));

  return NextResponse.json({ dates, engineers });
}
