import { NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';
import { SEED_USERS } from '@/lib/seedUsers';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

/**
 * One-off maintenance endpoint: prune the engineers table down to SEED_USERS,
 * (re)hash their passwords and grant every discipline. Destructive — admin only.
 */
export async function POST() {
  if (!(await verifyAdminToken())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const keepNames = SEED_USERS.map(u => u.name);

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: allEngineers } = await client.query('SELECT id, name FROM engineers');
    const deleted: string[] = [];
    for (const eng of allEngineers) {
      if (!keepNames.includes(eng.name)) {
        await client.query('DELETE FROM comments WHERE engineer_id = $1', [eng.id]);
        await client.query('DELETE FROM updates WHERE engineer_id = $1', [eng.id]);
        await client.query('DELETE FROM engineer_disciplines WHERE engineer_id = $1', [eng.id]);
        await client.query('DELETE FROM engineers WHERE id = $1', [eng.id]);
        deleted.push(eng.name);
      }
    }

    const { rows: disciplines } = await client.query('SELECT id FROM disciplines');
    const allDisciplineIds = disciplines.map((d: { id: number }) => d.id);

    const upserted: string[] = [];
    for (const user of SEED_USERS) {
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
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
