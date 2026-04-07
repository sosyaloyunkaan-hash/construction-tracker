import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET() {
  const isAdmin = await verifyAdminToken();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await query(`
    SELECT
      e.id,
      e.name,
      e.initials,
      e.avatar_color,
      COALESCE(
        json_agg(
          json_build_object('id', d.id, 'name', d.name)
          ORDER BY d.name
        ) FILTER (WHERE d.id IS NOT NULL),
        '[]'
      ) AS disciplines
    FROM engineers e
    LEFT JOIN engineer_disciplines ed ON e.id = ed.engineer_id
    LEFT JOIN disciplines d ON ed.discipline_id = d.id
    GROUP BY e.id, e.name, e.initials, e.avatar_color
    ORDER BY e.name
  `);

  return NextResponse.json(result.rows);
}

export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdminToken();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, password, initials, avatar_color, discipline_ids } = await request.json();

    if (!name || !password || !initials || !avatar_color) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { rows } = await query(
      'INSERT INTO engineers (name, password, initials, avatar_color) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, hashedPassword, initials.toUpperCase(), avatar_color]
    );

    const engineerId = rows[0].id;

    if (Array.isArray(discipline_ids) && discipline_ids.length > 0) {
      const vals = discipline_ids.map((_: number, i: number) => `($1, $${i + 2})`).join(',');
      await query(
        `INSERT INTO engineer_disciplines (engineer_id, discipline_id) VALUES ${vals}`,
        [engineerId, ...discipline_ids]
      );
    }

    return NextResponse.json({ id: engineerId }, { status: 201 });
  } catch (err) {
    console.error('Error creating engineer:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
