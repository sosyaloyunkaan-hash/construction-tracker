import bcrypt from 'bcryptjs';
import { ROOM_DATA } from './roomData';
import { SEED_USERS } from './seedUsers';
import { getBackend, type DbClient } from './dbBackend';

declare global {
  // eslint-disable-next-line no-var
  var __dbInit: Promise<void> | undefined;
}

/** A transactional client (BEGIN/COMMIT/ROLLBACK). Caller must `release()`. */
export async function getClient(): Promise<DbClient> {
  await ensureDB();
  return (await getBackend()).getClient();
}

/** Raw query with no schema bootstrap — used by the init path itself. */
async function rawQuery(text: string, params?: unknown[]) {
  return (await getBackend()).query(text, params);
}

/** Raw multi-statement exec (DDL) with no schema bootstrap. */
async function rawExec(sql: string) {
  return (await getBackend()).exec(sql);
}

/**
 * Ensures the schema exists before the first real query, exactly once per process.
 * On failure the memoised promise is cleared so the next request retries instead of
 * being stuck with a permanently rejected init.
 */
export function ensureDB(): Promise<void> {
  if (!global.__dbInit) {
    global.__dbInit = initDB().catch((err) => {
      global.__dbInit = undefined;
      throw err;
    });
  }
  return global.__dbInit;
}

export async function query(text: string, params?: unknown[]) {
  await ensureDB();
  return rawQuery(text, params);
}

export async function initDB() {
  await rawExec(`
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

    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      engineer_id INTEGER NOT NULL REFERENCES engineers(id),
      building_id INTEGER NOT NULL REFERENCES buildings(id),
      floor_id INTEGER NOT NULL REFERENCES floors(id),
      room_id INTEGER NOT NULL REFERENCES rooms(id),
      activity_id INTEGER NOT NULL REFERENCES activities(id),
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_updates_activity_lookup
      ON updates (activity_id, building_id, floor_id, room_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_updates_room_lookup
      ON updates (building_id, floor_id, room_id, discipline_id, activity_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_floors_building_order
      ON floors (building_id, floor_number);
    CREATE INDEX IF NOT EXISTS idx_rooms_floor_order
      ON rooms (floor_id);
    CREATE INDEX IF NOT EXISTS idx_activities_discipline
      ON activities (discipline_id);
    CREATE INDEX IF NOT EXISTS idx_engineer_disciplines_engineer
      ON engineer_disciplines (engineer_id, discipline_id);
  `);

  const { rows } = await rawQuery('SELECT COUNT(*)::int AS count FROM engineers');
  if (Number(rows[0].count) === 0) {
    await seedData();
  }
}

const FLOOR_ORDER = ['Ground', 'Podium 1', 'Podium 2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10', 'Roof'];

async function seedData() {
  const disciplineNames = ['MEP', 'Finishing', 'Civil', 'External Works'];
  const disciplineIds: Record<string, number> = {};

  for (const name of disciplineNames) {
    const { rows } = await rawQuery('INSERT INTO disciplines (name) VALUES ($1) RETURNING id', [name]);
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
    await rawQuery(`INSERT INTO activities (discipline_id, name) VALUES ${vals}`, params);
  }

  // Every seed engineer gets access to all disciplines.
  const allDisciplineIds = Object.values(disciplineIds);
  for (const eng of SEED_USERS) {
    const hash = bcrypt.hashSync(eng.password, 10);
    const { rows } = await rawQuery(
      'INSERT INTO engineers (name, password, initials, avatar_color) VALUES ($1, $2, $3, $4) RETURNING id',
      [eng.name, hash, eng.initials, eng.color]
    );
    for (const discId of allDisciplineIds) {
      await rawQuery('INSERT INTO engineer_disciplines (engineer_id, discipline_id) VALUES ($1, $2)', [rows[0].id, discId]);
    }
  }

  // Insert buildings, floors, rooms from CSV data
  for (const buildingName of Object.keys(ROOM_DATA).sort()) {
    const { rows: bRows } = await rawQuery(
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
      const { rows: fRows } = await rawQuery(
        'INSERT INTO floors (building_id, floor_number, name) VALUES ($1, $2, $3) RETURNING id',
        [bId, fi + 1, floorName]
      );
      const fId = fRows[0].id;

      const rooms = floorMap[floorName];
      if (rooms.length > 0) {
        const vals = rooms.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(',');
        const params = rooms.flatMap(r => [fId, r]);
        await rawQuery(`INSERT INTO rooms (floor_id, name) VALUES ${vals}`, params);
      }
    }
  }
}
