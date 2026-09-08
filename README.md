# Construction Site Progress Tracker

A mobile-first web app for tracking construction site progress per building, floor, room, discipline, and activity.

Stack: **Next.js 14 (App Router)** · **PostgreSQL** (`pg`) · **jose** (JWT cookies) · **bcryptjs** · **Tailwind CSS**.

## Quick Start

### 1. Install Node.js
Download and install the LTS version from https://nodejs.org

### 2. Configure environment
```
cp .env.example .env.local
```

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | prod only | Postgres connection string. **Leave unset locally** to use the embedded DB (see below). |
| `JWT_SECRET` | yes | Signs session cookies. App refuses to sign in production without it. |
| `ADMIN_PASSWORD` | yes (for `/admin`) | Password for the admin panel. Admin login returns 500 until set. |
| `SEED_PASSWORD_KAAN` / `SEED_PASSWORD_EREN` | no | Passwords for the two accounts created on first run. Default `changeme`. |
| `RESET_SECRET` | no | Guards the destructive DB reset endpoint. |
| `USE_PGLITE` | no | Set to `1` to force the embedded DB even when `DATABASE_URL` is set. |

Generate a JWT secret:
```
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 3. Start the app
```
npm install
npm run dev
```
Open http://localhost:3000

## Local trial — no database to install

If `DATABASE_URL` is not set, the app runs **PGlite**, an embedded Postgres that
lives inside the Node process and persists to `./.pglite/`. No Docker, no Postgres
server. Just `npm install && npm run dev`.

The committed `.env.local` is already set up for this, with:

| Account | Where | Password |
|---|---|---|
| `Kaan Ekinci` | `/login` | `kaan123` |
| `Eren` | `/login` | `eren123` |
| admin | `/admin` | `admin123` |

Delete the `.pglite/` folder to wipe all data and re-seed on the next request.

The schema is created automatically on the first request, and if the `engineers`
table is empty it is seeded with buildings/floors/rooms (from `rooms-input.csv`),
the four disciplines, their activities, and two engineer accounts.

## Accounts

Seeded engineers (both have access to all disciplines):

| Engineer | Password |
|---|---|
| Kaan Ekinci | `SEED_PASSWORD_KAAN` (default `changeme`) |
| Eren | `SEED_PASSWORD_EREN` (default `changeme`) |

Add, edit, or remove engineers and their discipline access from **`/admin`**
(log in with `ADMIN_PASSWORD`).

## How It Works

1. Engineer logs in with their name + password.
2. Step-by-step form: Building → Floor → Room → Discipline → Activity → Update.
3. Engineers with a single discipline skip the discipline step.
4. Discipline access is enforced server-side — unauthorized disciplines are rejected.
5. Progress slider drives status automatically (0% = Not Started, 1–99% = Ongoing, 100% = Completed).
6. "Hold" can be toggled at any progress except 100%.
7. Before submitting, the last recorded update for that exact location is shown.
8. Update Log tab lists all submissions newest-first with search and filter.
9. `/api/export` returns the latest state per location as an `.xlsx` file.

## Disciplines & Activities

MEP · Finishing · Civil · External Works — each with its own activity list (see `lib/db.ts`).

## Maintenance Endpoints

| Endpoint | Auth | Effect |
|---|---|---|
| `POST /api/admin/migrate-users` | admin cookie | Prunes engineers down to the seed list and re-hashes their passwords. |
| `POST /api/admin/reset?secret=…` | `RESET_SECRET` | **Drops every table** and re-seeds from scratch. |

## Deploy (Railway example)

1. Push this folder to a GitHub repo.
2. Create a Railway project → Deploy from GitHub, and add a PostgreSQL plugin.
3. Set environment variables: `DATABASE_URL` (from the plugin), `JWT_SECRET`,
   `ADMIN_PASSWORD`, and optionally `SEED_PASSWORD_*` / `RESET_SECRET`.
4. Deploy — Railway runs `next build` / `next start` automatically.

## Known Issues

- `xlsx@0.18.5` (used by `/api/export`) has unpatched advisories and no npm fix is
  available. Consider migrating the export route to `exceljs`.
