#!/usr/bin/env bash
# =============================================================================
# FILE: scripts/dev-up.sh
#
# WHY THIS FILE EXISTS
#   Starting Rahisisha by hand means: check Postgres, open a terminal for the
#   API, open another for the web app, wait, hope. A new person gets this
#   wrong. This script does the checks and the starting in ONE command:
#       ./scripts/dev-up.sh
#
# WHY IMPORTANT
#   The onboarding promise is "running in 10 minutes". A script is the only
#   way to keep that promise the same for everybody.
#
# DANGER
#   - It starts programs and leaves them running until you press Ctrl+C.
#   - It never writes or changes any file, database or .env.
#   - It never prints the contents of .env (they hold secrets).
#   - After Ctrl+C on Windows, a stray node.exe can sometimes survive. The
#     script tells you how to check (port 3000 / 3001).
#
# WHAT IT SOLVES
#   "I cloned the repo, now what do I type?"
#
# SYSTEM DESIGN PRINCIPLE
#   Fail early with a clear sentence. Check everything BEFORE starting
#   anything, so the problem is named in one line, not buried in logs.
#
# RULES
#   1. Run it from anywhere; it finds the repo root by itself.
#   2. It only READS: files, ports, the health URL.
#   3. One Ctrl+C stops both the API and the web app.
#
# TRADEOFFS
#   - Both programs write to one terminal, so their lines are mixed (each is
#     prefixed [api] or [web]).
#   - It does not start ngrok (only needed for M-Pesa demos; see RUNBOOK.md).
#   - It cannot start the Postgres Windows service for you.
#
# HOW TO USE (Git Bash, or any bash)
#   ./scripts/dev-up.sh
#   Then open http://localhost:3001  (API: http://localhost:3000/health)
# =============================================================================

set -u

# ---- PIECE 1: go to the repo root (like walking into the shop before opening)
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

fail() { echo "STOP: $1"; exit 1; }

echo "== Rahisisha dev-up =="

# ---- PIECE 2: is Node installed? (the engine of both programs)
command -v node >/dev/null 2>&1 || fail "Node.js is not installed. Install it from nodejs.org, then run this again."
echo "OK  node $(node -v)"

# ---- PIECE 3: are the packages installed? (three separate folders)
for dir in "." "apps/api" "apps/web"; do
  [ -d "$dir/node_modules" ] || fail "Packages missing in '$dir'. Run:  cd $dir  then  npm install"
done
echo "OK  packages installed (root, api, web)"

# ---- PIECE 4: do the settings files exist? (names only, never contents)
[ -f "apps/api/.env" ] || fail "apps/api/.env is missing. Copy apps/api/.env.example to apps/api/.env and fill it in (see docs/secrets.md)."
echo "OK  apps/api/.env exists"
if [ -f "apps/web/.env" ] || [ -f "apps/web/.env.local" ]; then
  echo "OK  web settings file exists"
else
  echo "WARN apps/web has no .env or .env.local. Copy apps/web/.env.example if the web app cannot reach the API."
fi

# ---- PIECE 5: are the ports free? (3000 for the API, 3001 for the web app)
port_busy() {
  # Windows (Git Bash) has netstat; Linux/macOS may have ss. Try both.
  if command -v netstat >/dev/null 2>&1; then
    netstat -an 2>/dev/null | grep -E "[:.]$1[[:space:]].*LISTEN" >/dev/null 2>&1
  elif command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | grep -E "[:.]$1[[:space:]]" >/dev/null 2>&1
  else
    return 1
  fi
}
port_busy 3000 && fail "Port 3000 is already in use (an old API still running?). See docs/RUNBOOK.md, incident 8."
port_busy 3001 && fail "Port 3001 is already in use (an old web app still running?). See docs/RUNBOOK.md, incident 8."
echo "OK  ports 3000 and 3001 are free"

# ---- PIECE 6: is Postgres up? (only if the check tool exists)
if command -v pg_isready >/dev/null 2>&1; then
  pg_isready -q || fail "Postgres is not answering. Start the Windows service (docs/RUNBOOK.md, incident 1)."
  echo "OK  Postgres answers"
else
  echo "WARN pg_isready not found, so Postgres was NOT checked. Make sure the Postgres service is Running."
fi

# ---- PIECE 7: start both, tag each line, and stop both on Ctrl+C
PIDS=()
cleanup() {
  echo
  echo "Stopping API and web app..."
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null; done
  echo "Done. If a port is still busy, see docs/RUNBOOK.md, incident 8."
  exit 0
}
trap cleanup INT TERM

( cd apps/api && npm run dev 2>&1 | sed -u 's/^/[api] /' ) &
PIDS+=($!)
( cd apps/web && npm run dev 2>&1 | sed -u 's/^/[web] /' ) &
PIDS+=($!)

# ---- PIECE 8: wait up to 60 seconds for the API health door
echo "Waiting for the API..."
for i in $(seq 1 60); do
  if curl -s http://localhost:3000/health 2>/dev/null | grep -q '"ok"'; then
    echo
    echo "READY  API:  http://localhost:3000/health"
    echo "READY  Web:  http://localhost:3001   (first page load compiles, give it a few seconds)"
    echo "Press Ctrl+C to stop both."
    break
  fi
  sleep 1
done

wait