import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { ROOM_DATA } from './roomData';

declare global {
  // eslint-disable-next-line no-var
  var __pool: Pool | undefined;
}

export function getPool(): Pool {
  if (!global.__pool) {
    global.__pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return global.__pool;
}

export async function query(text: string, params?: unknown[]) {
  const pool = getPool();
  return pool.query(text, params);
}

export async function initDB() {
  await query(`
    CREATE TABLE IF NOT EXISTS engineers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      password TEXT NOT NULL,
      initials TEXT NOT NULL,
      avatar_color TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS disciplines (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS engineer_disciplines (
      engineer_id INTEGER NOT NULL REFERENCES engineers(id),
      discipline_id INTEGER NOT NULL REFERENCES disciplines(id),
      PRIMARY KEY (engineer_id, discipline_id)
    );

    CREATE TABLE IF NOT EXISTS buildings (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS floors (
      id SERIAL PRIMARY KEY,
      building_id INTEGER NOT NULL REFERENCES buildings(id),
      floor_number INTEGER NOT NULL,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id SERIAL PRIMARY KEY,
      floor_id INTEGER NOT NULL REFERENCES floors(id),
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activities (
      id SERIAL PRIMARY KEY,
      discipline_id INTEGER NOT NULL REFERENCES disciplines(id),
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS updates (
      id SERIAL PRIMARY KEY,
      engineer_id INTEGER NOT NULL REFERENCES engineers(id),
      building_id INTEGER NOT NULL REFERENCES buildings(id),
      floor_id INTEGER NOT NULL REFERENCES floors(id),
      room_id INTEGER NOT NULL REFERENCES rooms(id),
      discipline_id INTEGER NOT NULL REFERENCES disciplines(id),
      activity_id INTEGER NOT NULL REFERENCES activities(id),
      status TEXT NOT NULL CHECK(status IN ('notstarted','ongoing','completed','hold')),
      progress INTEGER NOT NULL DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
      remarks TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const { rows } = await query('SELECT COUNT(*) FROM engineers');
  if (parseInt(rows[0].count) === 0) {
    await seedData();
  } else {
    await migrateUsers();
  }
}

async function migrateUsers() {
  const keepUsers = [
    { name: 'Kaan Ekinci', password: 'Kaan321456', initials: 'KE', color: '#0EA5E9' },
    { name: 'Eren',        password: 'Eren321456', initials: 'ER', color: '#22C55E' },
  ];
  const keepNames = keepUsers.map(u => u.name);

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Delete engineers not in keep list (delete updates + disciplines first)
    const { rows: allEngineers } = await client.query('SELECT id, name FROM engineers');
    for (const eng of allEngineers) {
      if (!keepNames.includes(eng.name)) {
        await client.query('DELETE FROM updates WHERE engineer_id = $1', [eng.id]);
        await client.query('DELETE FROM engineer_disciplines WHERE engineer_id = $1', [eng.id]);
        await client.query('DELETE FROM engineers WHERE id = $1', [eng.id]);
      }
    }

    // Get all discipline IDs
    const { rows: disciplines } = await client.query('SELECT id FROM disciplines');
    const allDisciplineIds = disciplines.map((d: { id: number }) => d.id);

    // Upsert each keep user
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
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

const FLOOR_ORDER = ['Ground', 'Podium 1', 'Podium 2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10', 'Roof'];

async function seedData() {
  const disciplineNames = ['MEP', 'Finishing', 'Civil', 'External Works'];
  const disciplineIds: Record<string, number> = {};

  for (const name of disciplineNames) {
    const { rows } = await query('INSERT INTO disciplines (name) VALUES ($1) RETURNING id', [name]);
    disciplineIds[name] = rows[0].id;
  }

  const activitiesMap: Record<string, string[]> = {
    MEP: [
      'Electrical conduit & wiring', 'Cable tray installation', 'DB board installation',
      'HVAC ductwork', 'AC unit installation', 'Plumbing rough-in', 'Plumbing fixtures',
      'Fire alarm system', 'Sprinkler system', 'CCTV & data cabling',
    ],
    Finishing: [
      'Floor ceramic tiling', 'Wall tiling', 'Gypsum ceiling', 'Gypsum partition',
      'Plastering', 'Painting – primer', 'Painting – finish coat',
      'Skirting installation', 'Door frame & door', 'Window installation',
    ],
    Civil: [
      'Concrete pour', 'Block work', 'Column shuttering', 'Rebar fixing',
      'Waterproofing', 'Screed', 'Structural steel erection',
    ],
    'External Works': [
      'Landscaping', 'Paving', 'Drainage', 'Boundary wall', 'External painting', 'Parking marking',
    ],
  };

  for (const [disc, acts] of Object.entries(activitiesMap)) {
    const vals = acts.map((a, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(',');
    const params = acts.flatMap(a => [disciplineIds[disc], a]);
    await query(`INSERT INTO activities (discipline_id, name) VALUES ${vals}`, params);
  }

  const engineers = [
    { name: 'Kaan Ekinci', password: 'Kaan321456', initials: 'KE', color: '#0EA5E9', disciplines: ['MEP', 'Finishing', 'Civil', 'External Works'] },
    { name: 'Eren',        password: 'Eren321456', initials: 'ER', color: '#22C55E', disciplines: ['MEP', 'Finishing', 'Civil', 'External Works'] },
  ];

  for (const eng of engineers) {
    const hash = bcrypt.hashSync(eng.password, 10);
    const { rows } = await query(
      'INSERT INTO engineers (name, password, initials, avatar_color) VALUES ($1, $2, $3, $4) RETURNING id',
      [eng.name, hash, eng.initials, eng.color]
    );
    for (const disc of eng.disciplines) {
      await query('INSERT INTO engineer_disciplines (engineer_id, discipline_id) VALUES ($1, $2)', [rows[0].id, disciplineIds[disc]]);
    }
  }

  // Insert buildings, floors, rooms from CSV data
  for (const buildingName of Object.keys(ROOM_DATA).sort()) {
    const { rows: bRows } = await query(
      'INSERT INTO buildings (name) VALUES ($1) RETURNING id',
      [buildingName]
    );
    const bId = bRows[0].id;

    const floorMap = ROOM_DATA[buildingName];
    const floors = Object.keys(floorMap).sort((a, b) => {
      const ai = FLOOR_ORDER.indexOf(a);
      const bi = FLOOR_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    for (let fi = 0; fi < floors.length; fi++) {
      const floorName = floors[fi];
      const { rows: fRows } = await query(
        'INSERT INTO floors (building_id, floor_number, name) VALUES ($1, $2, $3) RETURNING id',
        [bId, fi + 1, floorName]
      );
      const fId = fRows[0].id;

      const rooms = floorMap[floorName];
      if (rooms.length > 0) {
        const vals = rooms.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(',');
        const params = rooms.flatMap(r => [fId, r]);
        await query(`INSERT INTO rooms (floor_id, name) VALUES ${vals}`, params);
      }
    }
  }
}
