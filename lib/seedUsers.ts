export interface SeedUser {
  name: string;
  password: string;
  initials: string;
  color: string;
}

/**
 * The engineers that get created on first run and kept by the migrate-users route.
 *
 * Passwords are read from the environment. The `changeme` fallback is intentional:
 * it is only used when the corresponding env var is missing, so a misconfigured
 * deployment gets an obviously-broken password instead of a real one baked into
 * source control. Set SEED_PASSWORD_* in `.env.local` / your host before seeding.
 */
export const SEED_USERS: SeedUser[] = [
  {
    name: 'Kaan Ekinci',
    password: process.env.SEED_PASSWORD_KAAN || 'changeme',
    initials: 'KE',
    color: '#0EA5E9',
  },
  {
    name: 'Eren',
    password: process.env.SEED_PASSWORD_EREN || 'changeme',
    initials: 'ER',
    color: '#22C55E',
  },
];
