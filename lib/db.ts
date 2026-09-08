import bcrypt from 'bcryptjs';
import { ROOM_DATA } from './roomData';
import { SEED_USERS } from './seedUsers';
import { getBackend, type DbClient } from './dbBackend';
import { DEFAULT_PROJECTS, LEGACY_PROJECT_CODE, floorRank } from './projects';

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
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

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
      name TEXT NOT NULL,
      project_id INTEGER REFERENCES projects(id)
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
      project_id INTEGER REFERENCES projects(id),
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
      project_id INTEGER REFERENCES projects(id),
      building_id INTEGER NOT NULL REFERENCES buildings(id),
      floor_id INTEGER NOT NULL REFERENCES floors(id),
      room_id INTEGER NOT NULL REFERENCES rooms(id),
      activity_id INTEGER NOT NULL REFERENCES activities(id),
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Columns added by the projects feature. Present in the CREATE above for
    -- fresh installs; added here for databases that predate it.
    ALTER TABLE buildings ADD COLUMN IF NOT EXISTS project_id INTEGER;
    ALTER TABLE updates   ADD COLUMN IF NOT EXISTS project_id INTEGER;
    ALTER TABLE comments  ADD COLUMN IF NOT EXISTS project_id INTEGER;

    CREATE INDEX IF NOT EXISTS idx_updates_activity_lookup
      ON updates (activity_id, building_id, floor_id, room_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_updates_room_lookup
      ON updates (building_id, floor_id, room_id, discipline_id, activity_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_updates_project ON updates (project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_comments_project ON comments (project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_buildings_project ON buildings (project_id, name);
    CREATE INDEX IF NOT EXISTS idx_floors_building_order
      ON floors (building_id, floor_number);
    CREATE INDEX IF NOT EXISTS idx_rooms_floor_order
      ON rooms (floor_id);
    CREATE INDEX IF NOT EXISTS idx_activities_discipline
      ON activities (discipline_id);
    CREATE INDEX IF NOT EXISTS idx_engineer_disciplines_engineer
      ON engineer_disciplines (engineer_id, discipline_id);
  `);

  const projectIds = await ensureProjects();
  await migrateSchema(projectIds[LEGACY_PROJECT_CODE]);

  const { rows } = await rawQuery('SELECT COUNT(*)::int AS count FROM engineers');
  if (Number(rows[0].count) === 0) {
    await seedData(projectIds);
  }
}

/**
 * Backfill every row that predates the projects feature onto the legacy project.
 * Idempotent — the WHERE clauses make it a no-op once done.
 */
async function migrateSchema(legacyId: number) {
  const { rows: orphan } = await rawQuery(
    `SELECT
       (SELECT COUNT(*) FROM buildings WHERE project_id IS NULL)::int AS b,
       (SELECT COUNT(*) FROM updates   WHERE project_id IS NULL)::int AS u,
       (SELECT COUNT(*) FROM comments  WHERE project_id IS NULL)::int AS c`
  );
  if (orphan[0].b === 0 && orphan[0].u === 0 && orphan[0].c === 0) return;

  await rawQuery('UPDATE buildings SET project_id = $1 WHERE project_id IS NULL', [legacyId]);
  await rawQuery(
    'UPDATE updates SET project_id = b.project_id FROM buildings b WHERE updates.building_id = b.id AND updates.project_id IS NULL'
  );
  await rawQuery(
    'UPDATE comments SET project_id = b.project_id FROM buildings b WHERE comments.building_id = b.id AND comments.project_id IS NULL'
  );
}

/** Ensure every DEFAULT_PROJECTS row exists; returns a { code: id } map of all projects. */
async function ensureProjects(): Promise<Record<string, number>> {
  for (const p of DEFAULT_PROJECTS) {
    await rawQuery(
      `INSERT INTO projects (code, name) VALUES ($1, $2)
       ON CONFLICT (code) DO NOTHING`,
      [p.code, p.name]
    );
  }
  const { rows } = await rawQuery('SELECT id, code FROM projects');
  const map: Record<string, number> = {};
  for (const r of rows) map[r.code] = r.id;
  return map;
}

async function seedData(projectIds: Record<string, number>) {
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

  // The bundled room structure belongs to the legacy project. The other
  // DEFAULT_PROJECTS start empty and are filled via CSV import from /admin.
  const structure: RoomStructure = {};
  for (const [b, floorMap] of Object.entries(ROOM_DATA)) {
    structure[b] = {};
    for (const [f, rooms] of Object.entries(floorMap)) structure[b][f] = [...rooms];
  }
  await importRoomStructure(projectIds[LEGACY_PROJECT_CODE], structure);
}

export type RoomStructure = Record<string, Record<string, string[]>>;

export interface ImportResult {
  buildingsAdded: number;
  floorsAdded: number;
  roomsAdded: number;
}

/**
 * Insert a { building: { floor: [rooms] } } structure into one project.
 * Re-runnable: existing buildings/floors are reused, only missing rooms are added.
 */
export async function importRoomStructure(
  projectId: number,
  structure: RoomStructure
): Promise<ImportResult> {
  const res: ImportResult = { buildingsAdded: 0, floorsAdded: 0, roomsAdded: 0 };

  for (const buildingName of Object.keys(structure).sort()) {
    const floorMap = structure[buildingName];

    const { rows: existingB } = await rawQuery(
      'SELECT id FROM buildings WHERE project_id = $1 AND name = $2',
      [projectId, buildingName]
    );
    let bId: number;
    if (existingB.length) {
      bId = existingB[0].id;
    } else {
      const { rows } = await rawQuery(
        'INSERT INTO buildings (name, project_id) VALUES ($1, $2) RETURNING id',
        [buildingName, projectId]
      );
      bId = rows[0].id;
      res.buildingsAdded++;
    }

    const floorNames = Object.keys(floorMap).sort((a, b) => floorRank(a) - floorRank(b));
    for (let i = 0; i < floorNames.length; i++) {
      const floorName = floorNames[i];

      const { rows: existingF } = await rawQuery(
        'SELECT id FROM floors WHERE building_id = $1 AND name = $2',
        [bId, floorName]
      );
      let fId: number;
      if (existingF.length) {
        fId = existingF[0].id;
      } else {
        const { rows } = await rawQuery(
          'INSERT INTO floors (building_id, floor_number, name) VALUES ($1, $2, $3) RETURNING id',
          [bId, i + 1, floorName]
        );
        fId = rows[0].id;
        res.floorsAdded++;
      }

      const wanted = floorMap[floorName];
      if (!wanted.length) continue;
      const { rows: haveRows } = await rawQuery('SELECT name FROM rooms WHERE floor_id = $1', [fId]);
      const have = new Set(haveRows.map(r => r.name));
      const toAdd = wanted.filter(r => !have.has(r));
      if (toAdd.length) {
        const vals = toAdd.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(',');
        const params = toAdd.flatMap(r => [fId, r]);
        await rawQuery(`INSERT INTO rooms (floor_id, name) VALUES ${vals}`, params);
        res.roomsAdded += toAdd.length;
      }
    }
  }

  return res;
}

/** Parse a "Building,Floor,Room" CSV (header optional) into a RoomStructure. */
export function parseRoomCsv(text: string): RoomStructure {
  const out: RoomStructure = {};
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // split into 3 fields; the room name keeps any remaining commas
    const first = line.indexOf(',');
    const second = line.indexOf(',', first + 1);
    if (first === -1 || second === -1) continue;
    const building = line.slice(0, first).trim();
    const floor = line.slice(first + 1, second).trim();
    const room = line.slice(second + 1).trim().replace(/^"|"$/g, '');
    if (!building || !floor || !room) continue;
    if (i === 0 && /^building$/i.test(building)) continue; // header row
    (out[building] ??= {})[floor] ??= [];
    if (!out[building][floor].includes(room)) out[building][floor].push(room);
  }
  return out;
}
