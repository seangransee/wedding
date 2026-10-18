#!/bin/bash
# Prepares a Claude Code cloud session (claude.ai/code) to work like local dev:
# installs dependencies, starts the VM's pre-installed PostgreSQL, creates the
# wedding_local database, writes .env.local, runs migrations, and seeds sample
# guests into an empty database. It never touches production.

if [ "$CLAUDE_CODE_REMOTE" != "true" ]; then
  exit 0
fi

set -euo pipefail
cd "$CLAUDE_PROJECT_DIR"

DB_NAME=wedding_local
DB_USER=wedding
# VM-local only: Postgres listens on localhost inside the throwaway session VM.
DB_PASSWORD=wedding
LOCAL_DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"

hashes=node_modules/.cloud-session-start.sha256
if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  # Delete the old hashes first, so a failed install runs again next time.
  rm -f "$hashes"
  npm ci --no-audit --no-fund >&2
  sha256sum scripts/cloud-session-start.sh package.json package-lock.json .npmrc > "$hashes"
fi

service postgresql start >&2

as_postgres() {
  su postgres -c "$1"
}

as_postgres "psql -v ON_ERROR_STOP=1 -q" <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASSWORD';
  END IF;
END
\$\$;
SQL

if [ "$(as_postgres "psql -tAc \"SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'\"")" != "1" ]; then
  as_postgres "createdb -O $DB_USER $DB_NAME"
fi

# Keep any .env.local Claude or the user already edited in this session.
if [ ! -f .env.local ]; then
  # Use the environment's ADMIN_PASSWORD when one is set, otherwise make one up.
  admin_password="${ADMIN_PASSWORD:-$(openssl rand -hex 12)}"
  printf 'DATABASE_URL=%s\nADMIN_PASSWORD=%s\n' "$LOCAL_DATABASE_URL" "$admin_password" > .env.local
fi

DATABASE_URL="$LOCAL_DATABASE_URL" npm run --silent db:migrate >&2

guest_count="$(psql "$LOCAL_DATABASE_URL" -tAc "SELECT count(*) FROM wedding_guests")"
if [ "$guest_count" = "0" ]; then
  psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -q -f scripts/dev-seed.sql
fi

echo "Cloud dev setup done: Postgres is running with $DB_NAME at $LOCAL_DATABASE_URL, migrations are applied, and .env.local holds DATABASE_URL and ADMIN_PASSWORD for /admin. Production is not reachable from this session; production migrations run automatically in the Vercel production build."
