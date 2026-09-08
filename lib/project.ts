import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { query } from './db';
import { PROJECT_COOKIE } from './projects';

export interface Project {
  id: number;
  code: string;
  name: string;
}

/** The project id from the cookie, validated against the DB. null if unset/invalid. */
export async function getCurrentProjectId(): Promise<number | null> {
  const raw = cookies().get(PROJECT_COOKIE)?.value;
  const id = Number(raw);
  if (!raw || !Number.isInteger(id) || id <= 0) return null;

  const { rows } = await query('SELECT 1 FROM projects WHERE id = $1', [id]);
  return rows.length ? id : null;
}

export async function getCurrentProject(): Promise<Project | null> {
  const id = await getCurrentProjectId();
  if (id == null) return null;
  const { rows } = await query('SELECT id, code, name FROM projects WHERE id = $1', [id]);
  return rows[0] ?? null;
}

/**
 * For route handlers: returns the scoped project id, or a 409 response telling the
 * client to send the user to the project picker.
 *   const scope = await requireProject();
 *   if (scope instanceof NextResponse) return scope;
 */
export async function requireProject(): Promise<number | NextResponse> {
  const id = await getCurrentProjectId();
  if (id == null) {
    return NextResponse.json({ error: 'No project selected', code: 'NO_PROJECT' }, { status: 409 });
  }
  return id;
}
