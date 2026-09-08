/**
 * Database backend abstraction.
 *
 * - When `DATABASE_URL` is set (production, Railway, any real Postgres) it uses
 *   the `pg` connection pool.
 * - When `DATABASE_URL` is absent (or `USE_PGLITE=1`) it falls back to PGlite,
 *   an embedded WASM Postgres that runs inside the Node process and persists to
 *   a local folder. This makes `npm run dev` work with zero external setup.
 *
 * Both paths expose the same tiny surface: `query`, `exec` (multi-statement DDL)
 * and `getClient` (for BEGIN/COMMIT transactions).
 */

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number | null;
}

export interface DbClient {
  query<T = any>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
  release(): void;
}

export interface DbBackend {
  kind: 'pg' | 'pglite';
  query<T = any>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
  exec(sql: string): Promise<void>;
  getClient(): Promise<DbClient>;
}

declare global {
  // eslint-disable-next-line no-var
  var __dbBackend: Promise<DbBackend> | undefined;
}

async function createPgBackend(): Promise<DbBackend> {
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  return {
    kind: 'pg',
    query: (text, params) => pool.query(text, params as unknown[]) as never,
    exec: async (sql) => { await pool.query(sql); },
    getClient: async () => {
      const client = await pool.connect();
      return {
        query: (text, params) => client.query(text, params as unknown[]) as never,
        release: () => client.release(),
      };
    },
  };
}

async function createPgliteBackend(): Promise<DbBackend> {
  const { PGlite } = await import('@electric-sql/pglite');
  const dataDir = process.env.PGLITE_DATA_DIR || '.pglite';
  const db = new PGlite(dataDir);
  await db.waitReady;

  // PGlite is a single connection; a "client" is just the same instance. Raw
  // BEGIN/COMMIT/ROLLBACK statements work. Fine for local single-user trials.
  const run = async (text: string, params?: unknown[]): Promise<QueryResult> => {
    const r = await db.query(text, params as unknown[]);
    return { rows: r.rows as unknown[], rowCount: r.affectedRows ?? r.rows.length } as QueryResult;
  };

  return {
    kind: 'pglite',
    query: (text, params) => run(text, params) as never,
    exec: async (sql) => { await db.exec(sql); },
    getClient: async () => ({
      query: (text, params) => run(text, params) as never,
      release: () => {},
    }),
  };
}

export function getBackend(): Promise<DbBackend> {
  if (!global.__dbBackend) {
    const usePglite = !process.env.DATABASE_URL || process.env.USE_PGLITE === '1';
    global.__dbBackend = (usePglite ? createPgliteBackend() : createPgBackend()).catch((err) => {
      global.__dbBackend = undefined;
      throw err;
    });
  }
  return global.__dbBackend;
}
