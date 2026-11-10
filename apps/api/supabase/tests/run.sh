#!/usr/bin/env bash
# Runs the migrations + SQL tests against a THROWAWAY Postgres database.
# Usage: DATABASE_URL=postgres://... ./run.sh      (the database is wiped!)
set -euo pipefail
: "${DATABASE_URL:?set DATABASE_URL to a throwaway database}"
here="$(cd "$(dirname "$0")" && pwd)"
mig="$here/../migrations"
psql() { command psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q "$@"; }
psql -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'
psql -f "$here/00_supabase_stubs.sql"
psql -f "$mig/001_initial_schema.sql"
psql -f "$here/10_fixture.sql"
psql -f "$mig/002_integrity_and_performance.sql"
psql -f "$mig/002_integrity_and_performance.sql"   # must be idempotent
psql -f "$here/20_functions.test.sql"
