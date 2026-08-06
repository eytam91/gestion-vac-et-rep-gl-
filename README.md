# Gestion Vac & Rép - Production Runbook

This branch (realtime-auth-improvements) contains the changes required to make the app production-ready for a closed group of predefined users (secure local auth, realtime sync, transactional DB operations, non-destructive migrations and helper scripts).

IMPORTANT: before running any DB migration or one-time DB script you MUST create a database backup. See BACKUP section below.

---

## What is included in this branch

- Server
  - Secure local auth (bcrypt) for seeded users.
  - JWT issuance and central verification for HTTP and Socket.IO.
  - Socket.IO realtime broadcasting of compact deltas ({table, op, id, row}) after commits.
  - Transactional implementations for batch/reset/clear DB operations.

- Client
  - AuthContext with local auth + Socket.IO client integration.
  - App applies realtime deltas to employees and leave_records state to avoid full polling.

- DB
  - Non-destructive migration SQL: migrations/001-add-timestamps.sql (adds timestamptz columns and update triggers).
  - One-time idempotent script: scripts/migrate-seed-passwords.js (dry-run option and apply) to hash seeded passwords.

- Docs & scripts
  - This README (runbook)
  - scripts/smoke-test.sh — quick smoke tests using curl

---

## Environment variables (.env.example also provided)

- SQL_HOST — Postgres host
- SQL_PORT — Postgres port (optional; default 5432)
- SQL_USER — Postgres user
- SQL_PASSWORD — Postgres password
- SQL_DB_NAME — Postgres database name
- JWT_SECRET — strong server secret used to sign JWTs
- PORT — server port (optional; default 3000)
- REALTIME_WS_ALLOWED_ORIGINS — allowed origins for socket.io (restrict in production)

---

## Mandatory safety step (BACKUP)

Before running migrations or any DB update scripts, create a backup. Example (replace values):

pg_dump -h $SQL_HOST -U $SQL_USER -d $SQL_DB_NAME -F c -b -v -f backup-before-realtime.dump

Or create an SQL text dump:

pg_dump -h $SQL_HOST -U $SQL_USER -d $SQL_DB_NAME -f backup-before-realtime.sql

If your DB is cloud-hosted use provider snapshots instead.

---

## Apply migrations (non-destructive)

1. Ensure the backup exists.
2. Apply the migration file included in this branch:

psql -h $SQL_HOST -U $SQL_USER -d $SQL_DB_NAME -f migrations/001-add-timestamps.sql

This will:
- Add `created_at_ts` and `updated_at` (timestamptz) columns where missing.
- Attempt to backfill from existing text `created_at`/`timestamp` columns when values are ISO-compatible.
- Add `updated_at` triggers that set updated_at = now() on updates.

---

## One-time seeded password migration (dry-run then apply)

Dry-run to inspect changes:

export SQL_HOST=... SQL_USER=... SQL_PASSWORD=... SQL_DB_NAME=...
node scripts/migrate-seed-passwords.js --dry-run

If output is OK, apply:

node scripts/migrate-seed-passwords.js

This script is idempotent and affects only the known seeded users: admin@local.app and user1..user4.

---

## Build & Run (production)

Install deps:

npm install

Build and start:

npm run build
npm run start

(For dev/testing: `npm run dev` runs the TypeScript server + Vite middleware.)

---

## Smoke tests (quick)

You can use the provided script `scripts/smoke-test.sh` (or run the curl commands inside). It verifies login, protected endpoints and realtime connect (manual check).

---

## Rollback plan

If a migration causes problems, stop the server and restore DB from the dump:

pg_restore -h $SQL_HOST -U $SQL_USER -d $SQL_DB_NAME -v backup-before-realtime.dump

or

psql -h $SQL_HOST -U $SQL_USER -d $SQL_DB_NAME -f backup-before-realtime.sql

---

## Next steps I will take (after you confirm backup exists)

- Finalize this Pull Request with all changes on branch `realtime-auth-improvements`.
- Provide exact one-line commands to apply migrations and the one-time password script in your environment.
- Guide you through smoke tests and production checks.

If you want me to open the PR for you (I prepared all commits on the branch), go to:

https://github.com/eytam91/gestion-vac-et-rep-gl-/compare/main...realtime-auth-improvements?expand=1

and create the Pull Request, or I can provide the PR content here for you to paste.

---

If anything fails during migration or smoke-tests, paste the error logs here and I will guide you through mitigation and fixes.
