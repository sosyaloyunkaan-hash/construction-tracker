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

// ---------------------------------------------------------------------------
// CSV round-trip (Building,Floor,Room[,Discipline,Activity,Progress,Status,Remarks])
// ---------------------------------------------------------------------------

export const PROJECT_CSV_HEADERS = [
  'Building', 'Floor', 'Room', 'Discipline', 'Activity', 'Progress', 'Status', 'Remarks',
] as const;

const STATUS_LABEL: Record<string, string> = {
  notstarted: 'Not Started', ongoing: 'Ongoing', completed: 'Completed', hold: 'Hold',
};

export function statusLabel(s: string): string {
  return STATUS_LABEL[s] ?? s;
}

/** Progress + optional status text -> canonical status enum (matches the updates API). */
export function deriveStatus(progress: number, rawStatus?: string): string {
  const s = (rawStatus || '').toLowerCase().replace(/[^a-z]/g, '');
  const isHold = s === 'hold' || s === 'onhold';
  if (progress >= 100) return 'completed';
  if (isHold) return 'hold';
  if (progress <= 0) return 'notstarted';
  return 'ongoing';
}

/** Minimal RFC-4180 CSV parser (handles quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const stripBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < stripBom.length; i++) {
    const c = stripBom[i];
    if (inQuotes) {
      if (c === '"') {
        if (stripBom[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim() !== ''));
}

export function csvCell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headerRow: readonly string[], dataRows: (string | number | null)[][]): string {
  const lines = [headerRow.map(csvCell).join(',')];
  for (const r of dataRows) lines.push(r.map(csvCell).join(','));
  return lines.join('\r\n') + '\r\n';
}

export interface ParsedUpdate {
  building: string;
  floor: string;
  room: string;
  discipline: string;
  activity: string;
  progress: number;
  status?: string;
  remarks: string;
}

export interface ParsedProjectCsv {
  structure: RoomStructure;
  updates: ParsedUpdate[];
}

/**
 * Parse an exported project CSV. Always yields the room structure from the first
 * three columns; rows that also carry Discipline + Activity + a numeric Progress
 * additionally yield a status update.
 */
export function parseProjectCsv(text: string): ParsedProjectCsv {
  const rows = parseCsv(text);
  const out: ParsedProjectCsv = { structure: {}, updates: [] };
  if (!rows.length) return out;

  // Header detection / column mapping
  let start = 0;
  const idx: Record<string, number> = {};
  const first = rows[0].map(c => c.trim().toLowerCase());
  if (first[0] === 'building') {
    start = 1;
    first.forEach((h, i) => { idx[h] = i; });
  } else {
    ['building', 'floor', 'room', 'discipline', 'activity', 'progress', 'status', 'remarks']
      .forEach((h, i) => { idx[h] = i; });
  }
  const col = (r: string[], key: string) => (idx[key] != null ? (r[idx[key]] ?? '').trim() : '');

  for (let i = start; i < rows.length; i++) {
    const r = rows[i];
    const building = col(r, 'building');
    const floor = col(r, 'floor');
    const room = col(r, 'room');
    if (!building || !floor || !room) continue;

    (out.structure[building] ??= {})[floor] ??= [];
    if (!out.structure[building][floor].includes(room)) out.structure[building][floor].push(room);

    const discipline = col(r, 'discipline');
    const activity = col(r, 'activity');
    const progressRaw = col(r, 'progress');
    if (discipline && activity && progressRaw !== '') {
      const progress = Math.max(0, Math.min(100, Math.round(Number(progressRaw))));
      if (!Number.isNaN(progress)) {
        out.updates.push({
          building, floor, room, discipline, activity,
          progress, status: col(r, 'status'), remarks: col(r, 'remarks'),
        });
      }
    }
  }
  return out;
}

/** A dedicated, non-login engineer that owns rows created by CSV import. */
export async function getImportEngineerId(): Promise<number> {
  const { rows } = await rawQuery("SELECT id FROM engineers WHERE name = 'CSV Import'");
  if (rows.length) return rows[0].id;

  const hash = bcrypt.hashSync(`import-${Date.now()}-${Math.random()}`, 10);
  const { rows: ins } = await rawQuery(
    "INSERT INTO engineers (name, password, initials, avatar_color) VALUES ('CSV Import', $1, 'IM', '#64748B') RETURNING id",
    [hash]
  );
  const id = ins[0].id;
  const { rows: discs } = await rawQuery('SELECT id FROM disciplines');
  for (const d of discs) {
    await rawQuery(
      'INSERT INTO engineer_disciplines (engineer_id, discipline_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [id, d.id]
    );
  }
  return id;
}

export interface UpdatesImportResult {
  updatesAdded: number;
  updatesSkipped: number;
}

/** Resolve names -> ids within one project and append update rows. */
export async function applyImportedUpdates(
  projectId: number,
  updates: ParsedUpdate[]
): Promise<UpdatesImportResult> {
  const res: UpdatesImportResult = { updatesAdded: 0, updatesSkipped: 0 };
  if (!updates.length) return res;

  const engineerId = await getImportEngineerId();

  for (const u of updates) {
    const { rows } = await rawQuery(
      `SELECT b.id AS building_id, f.id AS floor_id, r.id AS room_id,
              d.id AS discipline_id, a.id AS activity_id
       FROM buildings b
       JOIN floors f  ON f.building_id = b.id AND f.name = $3
       JOIN rooms  r  ON r.floor_id = f.id   AND r.name = $4
       JOIN disciplines d ON lower(d.name) = lower($5)
       JOIN activities  a ON a.discipline_id = d.id AND lower(a.name) = lower($6)
       WHERE b.project_id = $1 AND b.name = $2
       LIMIT 1`,
      [projectId, u.building, u.floor, u.room, u.discipline, u.activity]
    );
    if (!rows.length) { res.updatesSkipped++; continue; }

    const { building_id, floor_id, room_id, discipline_id, activity_id } = rows[0];
    const status = deriveStatus(u.progress, u.status);
    await rawQuery(
      `INSERT INTO updates
         (engineer_id, project_id, building_id, floor_id, room_id, discipline_id, activity_id, status, progress, remarks)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [engineerId, projectId, building_id, floor_id, room_id, discipline_id, activity_id,
       status, u.progress, u.remarks || '']
    );
    res.updatesAdded++;
  }
  return res;
}
