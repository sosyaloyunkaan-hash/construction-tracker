export interface ProjectSeed {
  code: string;
  name: string;
}

/**
 * Projects created on first run / ensured on every boot.
 * The FIRST entry is the "legacy" project — any pre-existing buildings/updates
 * that have no project yet are attached to it during migration.
 */
export const DEFAULT_PROJECTS: ProjectSeed[] = [
  { code: 'DMS 111', name: 'Bay Residences' },
  { code: 'DMS 222', name: 'Beach Residences' },
  { code: 'DMS 333', name: 'RIXOS Hotel' },
];

export const LEGACY_PROJECT_CODE = DEFAULT_PROJECTS[0].code;

/** Cookie that remembers which project the user is currently working in. */
export const PROJECT_COOKIE = 'project_id';

/** Floor display order used when importing / seeding room structures. */
export const FLOOR_ORDER = [
  'Ground', 'Podium 1', 'Podium 2',
  'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10',
  'L11', 'L12', 'L13', 'L14', 'L15', 'Roof',
];

export function floorRank(name: string): number {
  const i = FLOOR_ORDER.indexOf(name);
  return i === -1 ? 999 : i;
}
