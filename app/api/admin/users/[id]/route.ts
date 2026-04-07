import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const isAdmin = await verifyAdminToken();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    const { name, password, initials, avatar_color, discipline_ids } = await request.json();

    if (!name || !initials || !avatar_color) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
      await query(
        'UPDATE engineers SET name = $1, password = $2, initials = $3, avatar_color = $4 WHERE id = $5',
        [name, hashedPassword, initials.toUpperCase(), avatar_color, id]
      );
    } else {
      await query(
        'UPDATE engineers SET name = $1, initials = $2, avatar_color = $3 WHERE id = $4',
        [name, initials.toUpperCase(), avatar_color, id]
      );
    }

    await query('DELETE FROM engineer_disciplines WHERE engineer_id = $1', [id]);

    if (Array.isArray(discipline_ids) && discipline_ids.length > 0) {
      const vals = discipline_ids.map((_: number, i: number) => `($1, $${i + 2})`).join(',');
      await query(
        `INSERT INTO engineer_disciplines (engineer_id, discipline_id) VALUES ${vals}`,
        [id, ...discipline_ids]
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error updating engineer:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const isAdmin = await verifyAdminToken();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    await query('DELETE FROM engineer_disciplines WHERE engineer_id = $1', [id]);
    await query('DELETE FROM engineers WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting engineer:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
