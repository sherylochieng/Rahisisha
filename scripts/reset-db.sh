#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# FILE: scripts/reset-db.sh
# ═══════════════════════════════════════════════════════════
#
# ┌─────────────────────────────────────────────────────────┐
# │ STORY OF THIS CHANGE (Task 7: CI)  — read this first    │
# ├─────────────────────────────────────────────────────────┤
# │ BEFORE: Safety 4 always stopped and waited for a HUMAN  │
# │   to type the database name. Fine on your laptop.       │
# │                                                         │
# │ PROBLEM: The GitHub robot (CI) has no keyboard. It      │
# │   printed "This will DELETE..." then the read failed    │
# │   and the script quit with exit code 1. First CI run    │
# │   went RED.                                             │
# │                                                         │
# │ AFTER: The script first looks for RESET_DB_CONFIRM in   │
# │   the environment. If it is empty, it asks a human, as  │
# │   before. Either way the name must match DB_NAME        │
# │   EXACTLY, or nothing is deleted.                       │
# │                                                         │
# │ WHY NOT JUST REMOVE THE QUESTION? Because the question  │
# │   protects you from deleting the wrong database. We     │
# │   kept the protection and only gave the robot another   │
# │   way to answer it (like a bank: a person signs, or a   │
# │   company's authorised system sends the same code).     │
# │                                                         │
# │ CHANGED PLACES (search for "CHANGED (Task 7)"):         │
# │   1. HOW TO USE (header)  2. DECISIONS (header)         │
# │   3. Piece-by-piece item 6  4. Safety 4 (the code)      │
# └─────────────────────────────────────────────────────────┘
#
# WHY THIS FILE EXISTS
#   Tests, signups and experiments leave junk in the dev
#   database (test shops, test products). This script gives you
#   a clean database with one command, the same way every time.
#
# WHY IMPORTANT
#   - A repeatable starting point means demos and reviews never
#     start from a messy room.
#   - It proves the whole database can be rebuilt from the files
#     in the repo (SCHEMA.sql), not from memory.
#
# DANGER (what breaks if misused)
#   It DELETES the whole database. Run on the wrong database, you
#   lose real data. So it: (1) refuses non-local hosts, (2) refuses
#   when NODE_ENV=production, (3) makes you TYPE the database name
#   (or pass it as RESET_DB_CONFIRM in CI) before it deletes anything.
#
# WHAT IT SOLVES
#   Junk piling up in dev, "works on my machine" data, and the
#   question "can we rebuild the database from scratch?".
#
# SYSTEM DESIGN PRINCIPLE
#   "Repeatable setup" (infrastructure you can rebuild with one
#   command) and "fail loudly, fail early". set -euo pipefail makes
#   the script stop at the FIRST problem instead of carrying on
#   with a half-built database. Then it VERIFIES its own result.
#
# RULES (never do this)
#   1. NEVER run it against a database you cannot lose.
#   2. NEVER hard-code passwords in this file. It asks for them,
#      or reads PGPASSWORD-style environment variables.
#   3. NEVER remove the confirmation or the host check.
#      (Task 7: the confirmation may be answered by RESET_DB_CONFIRM,
#      but it must still match the database name exactly.)
#   4. NEVER save this file with Windows line endings (CRLF).
#      bash cannot run them. In VS Code, click CRLF at the bottom
#      right and choose LF.
#   5. NEVER put real customer data in demo-data.sql.
#   6. NEVER set RESET_DB_CONFIRM in your normal shell profile. It
#      is only for pipelines. If it is always set, you lose the
#      "type it yourself" pause that protects you.
#
# PRACTICAL EXAMPLE
#   Before a demo:
#     bash scripts/reset-db.sh
#   (type the database name, type two passwords)
#   Two minutes later: a clean database, 18 locks verified, and
#   the 3 demo shops loaded.
#
# DECISIONS
#   - Settings can be overridden by environment variables, so you
#     can test on a scratch database first:
#       DB_NAME=rahisisha_scratch bash scripts/reset-db.sh
#   - Two roles: the admin (postgres) drops and creates the
#     database; the app user (rahisisha_user) loads the schema, so
#     the tables are owned by the same user the app logs in as,
#     exactly like today.
#   - The database is created WITH OWNER = the app user, so the
#     app user can create objects in the public schema (Postgres 15+
#     no longer lets everyone do that).
#   - demo-data.sql is optional here, so Task 5 works before
#     Task 6 exists.
#   - CHANGED (Task 7): the confirmation can come from the
#     RESET_DB_CONFIRM environment variable, so a CI robot can run
#     this same script. One script for laptop AND robot means the
#     robot proves the real thing, not a copy of it.
#
# WHERE YOU WILL USE THIS
#   - Before demos and reviews
#   - After a messy test day
#   - In CI (.github/workflows/ci.yml): the proof that the schema loads
#
# TRADEOFFS
#   + One command, repeatable, self-checking.
#   - Destroys data, by design.
#   - Asks for two passwords each run (safer than storing them).
#   - CHANGED (Task 7): a pipeline can now skip the typing. That is
#     safe only because the name must still match exactly and the
#     host check still allows localhost only.
#
# HOW TO USE
#   1. Stop the API (npm run dev in apps/api) and any tests.
#   2. From the repo root, in PowerShell:
#        & "C:\Program Files\Git\bin\bash.exe" scripts/reset-db.sh
#      Test first on a scratch database:
#        $env:DB_NAME="rahisisha_scratch"
#        & "C:\Program Files\Git\bin\bash.exe" scripts/reset-db.sh
#   3. Type the database name when asked, then the passwords.
#   CHANGED (Task 7), added:
#   4. In CI there is nobody to type: set RESET_DB_CONFIRM, ADMIN_PASSWORD
#      and APP_PASSWORD in the environment (see .github/workflows/ci.yml).
#
# ═══════════════════════════════════════════════════════════
# EXPLAINED PIECE BY PIECE (real life + where / when / how)
# ═══════════════════════════════════════════════════════════
#
# 1. set -euo pipefail  =  "STOP THE MOMENT SOMETHING GOES WRONG"
#    -e stop on any error, -u stop on a misspelled variable,
#    pipefail stop if any part of a chain fails. Like a cook who
#    stops when the oven fails, instead of serving raw food.
#
# 2. DB_NAME=${DB_NAME:-rahisisha}  =  "USE THIS UNLESS TOLD OTHERWISE"
#    A default that you can override from outside.
#
# 3. die()  =  THE EMERGENCY STOP BUTTON
#    Prints a clear reason and exits with an error.
#
# 4. The host check  =  THE "ARE YOU IN THE RIGHT BUILDING?" GUARD
#    Only localhost is allowed. A remote server is refused.
#
# 5. read -p / read -s  =  ASKING QUESTIONS
#    -s hides what you type (passwords never appear on screen).
#
# 6. Typing the database name  =  THE "TYPE DELETE TO CONFIRM" BOX
#    A mistyped name cancels everything.
#    CHANGED (Task 7): a robot cannot type, so it may fill the box
#    ahead of time using RESET_DB_CONFIRM. The box still checks the
#    answer. Real life: a person signs a form in person, OR an
#    authorised system sends the same signature. Either way the
#    signature must match, or nothing happens.
#    WHERE: ci.yml, in the "Build the database" step.
#    WHEN: only when nobody is there to type.
#    HOW: RESET_DB_CONFIRM=rahisisha bash scripts/reset-db.sh
#
# 7. pg_terminate_backend  =  ASKING EVERYONE TO LEAVE THE ROOM
#    Postgres will not delete a database while someone is
#    connected, so we disconnect them first.
#
# 8. ON_ERROR_STOP=1  =  PSQL STOPS AT THE FIRST SQL ERROR
#    By default psql keeps going and hides problems.
#
# 9. The verify step  =  CHECKING THE LOCKS BEFORE OPENING THE SHOP
#    Counts the row-level-security rules (18) and the login_lookup
#    rule. A missing rule means logins would silently break.
# ═══════════════════════════════════════════════════════════

set -euo pipefail

# ── Settings (override with environment variables) ───────────
DB_NAME="${DB_NAME:-rahisisha}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
ADMIN_USER="${ADMIN_USER:-postgres}"      # may drop/create databases
APP_USER="${APP_USER:-rahisisha_user}"    # the user the app logs in as
EXPECTED_POLICIES=18                      # 17 tenant_isolation + login_lookup (whatsapp_dedupe added in migration 024), from isolation-proof.md

# Always work from the repo root, wherever the script was started
cd "$(dirname "$0")/.."

# ── die: print a reason and stop ─────────────────────────────
die() {
  echo "STOPPED: $1" >&2
  exit 1
}

# ── Safety 1: only a local database ──────────────────────────
case "$DB_HOST" in
  localhost|127.0.0.1) ;;
  *) die "DB_HOST is '$DB_HOST'. This script only runs on localhost." ;;
esac

# ── Safety 2: never in production mode ───────────────────────
if [ "${NODE_ENV:-}" = "production" ]; then
  die "NODE_ENV is production. Refusing to delete a database."
fi

# ── Safety 3: the files we need must exist ───────────────────
[ -f sql/SCHEMA.sql ] || die "sql/SCHEMA.sql not found (run from the repo root)."
command -v psql >/dev/null 2>&1 || die "psql not found. Use Git Bash, not WSL."

# ── Safety 4: the database name must be confirmed ────────────
echo "This will DELETE the database '$DB_NAME' on $DB_HOST:$DB_PORT"
echo "and build a new empty one. Everything inside it will be lost."

# BEFORE (Task 5):
#   read -r -p "Type the database name to confirm: " CONFIRM
#   [ "$CONFIRM" = "$DB_NAME" ] || die "Name did not match. Nothing was deleted."
#   -> Always waited for a human. A robot has no keyboard, so the
#      read failed and the script exited with code 1.
#
# AFTER (Task 7):
#   A human types the name. A pipeline (CI) has nobody to type, so it
#   may pass the name in RESET_DB_CONFIRM instead. The check is
#   identical: the name must match DB_NAME exactly, so a wrong or
#   missing value still stops the script.
CONFIRM="${RESET_DB_CONFIRM:-}"
if [ -z "$CONFIRM" ]; then
  read -r -p "Type the database name to confirm: " CONFIRM
fi
[ "$CONFIRM" = "$DB_NAME" ] || die "Name did not match. Nothing was deleted."

# ── Passwords: from the environment, or ask (hidden) ─────────
if [ -z "${ADMIN_PASSWORD:-}" ]; then
  read -r -s -p "Password for admin user '$ADMIN_USER': " ADMIN_PASSWORD
  echo
fi
if [ -z "${APP_PASSWORD:-}" ]; then
  read -r -s -p "Password for app user '$APP_USER': " APP_PASSWORD
  echo
fi

# Small helpers that run psql as the admin or as the app user
admin_psql() {
  PGPASSWORD="$ADMIN_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" \
    -d postgres -v ON_ERROR_STOP=1 -q "$@"
}
app_psql() {
  PGPASSWORD="$APP_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$APP_USER" \
    -d "$DB_NAME" -v ON_ERROR_STOP=1 -q "$@"
}

# ── Check the app user exists before we delete anything ──────
HAS_ROLE=$(admin_psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$APP_USER'")
[ "$HAS_ROLE" = "1" ] || die "Role '$APP_USER' does not exist. Nothing was deleted."

# ── Step 1: disconnect everyone, then delete the database ────
echo "1/5 Deleting database '$DB_NAME'..."
admin_psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" >/dev/null
admin_psql -c "DROP DATABASE IF EXISTS \"$DB_NAME\";"

# ── Step 2: build a new empty one, owned by the app user ─────
echo "2/5 Creating a new empty database..."
admin_psql -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$APP_USER\";"

# ── Step 3: load the tables and locks ────────────────────────
echo "3/5 Loading sql/SCHEMA.sql..."
app_psql -f sql/SCHEMA.sql >/dev/null

# ── Step 4: verify the locks (row-level security) ────────────
echo "4/5 Checking the locks..."
POLICIES=$(app_psql -tAc "SELECT count(*) FROM pg_policies WHERE schemaname = 'public'")
[ "$POLICIES" = "$EXPECTED_POLICIES" ] || die "Expected $EXPECTED_POLICIES policies, found $POLICIES. SCHEMA.sql may be out of date."

LOGIN_LOOKUP=$(app_psql -tAc "SELECT count(*) FROM pg_policies WHERE tablename = 'memberships' AND policyname = 'login_lookup'")
[ "$LOGIN_LOOKUP" = "1" ] || die "The login_lookup rule is missing. Logins would break."

echo "    OK: $POLICIES policies, login_lookup present."

# ── Step 5: demo shops (optional until Task 6 exists) ────────
if [ -f scripts/demo-data.sql ]; then
  echo "5/5 Loading demo data..."
  app_psql -f scripts/demo-data.sql >/dev/null
else
  echo "5/5 scripts/demo-data.sql not found yet. Skipping demo data."
fi

echo
echo "Done. '$DB_NAME' is clean and ready."