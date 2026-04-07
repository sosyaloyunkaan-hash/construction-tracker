import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  const keepUsers = [
    { name: 'Kaan Ekinci', password: 'Kaan321456', initials: 'KE', color: '#0EA5E9' },
    { name: 'Eren',        password: 'Eren321456', initials: 'ER', color: '#22C55E' },
  ];
  const keepNames = keepUsers.map(u => u.name);

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: allEngineers } = await client.query('SELECT id, name FROM engineers');
    const deleted: string[] = [];
    for (const eng of allEngineers) {
      if (!keepNames.includes(eng.name)) {
        await client.query('DELETE FROM updates WHERE engineer_id = $1', [eng.id]);
        await client.query('DELETE FROM engineer_disciplines WHERE engineer_id = $1', [eng.id]);
        await client.query('DELETE FROM engineers WHERE id = $1', [eng.id]);
        deleted.push(eng.name);
      }
    }

    const { rows: disciplines } = await client.query('SELECT id FROM disciplines');
    const allDisciplineIds = disciplines.map((d: { id: number }) => d.id);

    const upserted: string[] = [];
    for (const user of keepUsers) {
      const hash = bcrypt.hashSync(user.password, 10);
      const { rows: existing } = await client.query('SELECT id FROM engineers WHERE name = $1', [user.name]);
      let engineerId: number;
      if (existing.length > 0) {
        engineerId = existing[0].id;
        await client.query(
          'UPDATE engineers SET password = $1, initials = $2, avatar_color = $3 WHERE id = $4',
          [hash, user.initials, user.color, engineerId]
        );
      } else {
        const { rows } = await client.query(
          'INSERT INTO engineers (name, password, initials, avatar_color) VALUES ($1, $2, $3, $4) RETURNING id',
          [user.name, hash, user.initials, user.color]
        );
        engineerId = rows[0].id;
      }
      await client.query('DELETE FROM engineer_disciplines WHERE engineer_id = $1', [engineerId]);
      for (const discId of allDisciplineIds) {
        await client.query(
          'INSERT INTO engineer_disciplines (engineer_id, discipline_id) VALUES ($1, $2)',
          [engineerId, discId]
        );
      }
      upserted.push(user.name);
    }

    await client.query('COMMIT');
    return NextResponse.json({ success: true, deleted, upserted });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('migrate-users failed:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  } finally {
    client.release();
  }
}
