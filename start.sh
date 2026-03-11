#!/usr/bin/env bash
set -euo pipefail

# ─── Farben ───────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
MODE="${1:-}"
BACKEND_PID=""
FRONTEND_PID=""

info()  { printf "${BLUE}[INFO]${NC}  %s\n" "$1"; }
ok()    { printf "${GREEN}[OK]${NC}    %s\n" "$1"; }
warn()  { printf "${YELLOW}[WARN]${NC}  %s\n" "$1"; }
error() { printf "${RED}[FEHLER]${NC} %s\n" "$1"; }
die()   { error "$1"; echo ""; exit 1; }

# ─── Hilfe ────────────────────────────────────────────────
if [ "$MODE" = "--help" ] || [ "$MODE" = "-h" ]; then
  echo ""
  printf "${BOLD}Timebooking – Start-Skript${NC}\n"
  echo ""
  echo "  Verwendung: ./start.sh [MODUS]"
  echo ""
  echo "  Modi:"
  echo "    (ohne)       Startet Frontend + Backend (Google Calendar Import)"
  echo "    --local      Startet nur das Frontend (manuelle Zeiterfassung)"
  echo "    --help       Diese Hilfe anzeigen"
  echo ""
  echo "  Im --local Modus funktioniert alles außer Google Calendar Import:"
  echo "  Manuelle Einträge, Projekte, Export (PDF/CSV) – alles über LocalStorage."
  echo ""
  exit 0
fi

echo ""
printf "${BOLD}╔══════════════════════════════════════╗${NC}\n"
if [ "$MODE" = "--local" ]; then
printf "${BOLD}║     Timebooking – Lokal-Modus        ║${NC}\n"
else
printf "${BOLD}║        Timebooking – Start           ║${NC}\n"
fi
printf "${BOLD}╚══════════════════════════════════════╝${NC}\n"
echo ""

# ─── 1. Node.js prüfen ───────────────────────────────────
if ! command -v node &> /dev/null; then
  die "Node.js ist nicht installiert.
       Installiere Node.js >= 20: https://nodejs.org/
       Oder via nvm: nvm install 20"
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  die "Node.js v${NODE_VERSION} erkannt – mindestens v20 erforderlich.
       Aktualisiere mit: nvm install 20 && nvm use 20"
fi
ok "Node.js $(node -v)"

# ─── 2. npm prüfen ───────────────────────────────────────
if ! command -v npm &> /dev/null; then
  die "npm ist nicht installiert. Kommt normalerweise mit Node.js."
fi
ok "npm $(npm -v)"

# ─── 3. Backend .env prüfen (nur im Vollmodus) ──────────
if [ "$MODE" != "--local" ]; then
  ENV_FILE="$ROOT_DIR/backend/.env"

  if [ ! -f "$ENV_FILE" ]; then
    die "Backend .env Datei fehlt!

       Führe aus:
         cd backend && cp .env.example .env

       Dann trage deine Google OAuth Credentials ein.
       Anleitung: siehe SETUP.md

       Tipp: Nur manuelle Zeiterfassung ohne Google? Starte mit:
         ./start.sh --local"
  fi

  check_env_var() {
    local var_name=$1
    local hint=$2
    local value
    value=$(grep "^${var_name}=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2-)

    if [ -z "$value" ] || [ "$value" = "your-client-id-here" ] || [ "$value" = "your-client-secret-here" ] || [ "$value" = "change-me-in-production" ]; then
      die "${var_name} ist nicht konfiguriert in backend/.env

       ${hint}
       Anleitung: siehe SETUP.md

       Tipp: Nur manuelle Zeiterfassung ohne Google? Starte mit:
         ./start.sh --local"
    fi
  }

  check_env_var "GOOGLE_CLIENT_ID" \
    "Erstelle OAuth2 Credentials in der Google Cloud Console:
       https://console.cloud.google.com/apis/credentials"

  check_env_var "GOOGLE_CLIENT_SECRET" \
    "Das Client Secret findest du in der Google Cloud Console
       unter APIs & Dienste → Anmeldedaten → dein OAuth Client."

  check_env_var "SESSION_SECRET" \
    "Setze einen zufälligen String. Generiere einen mit:
       openssl rand -hex 32"

  ok "Backend .env konfiguriert"
else
  info "Lokal-Modus: Backend wird übersprungen (kein Google Calendar)"
fi

# ─── 4. Dependencies installieren ────────────────────────
info "Prüfe Dependencies..."

if [ "$MODE" != "--local" ]; then
  if [ ! -d "$ROOT_DIR/backend/node_modules" ]; then
    info "Installiere Backend Dependencies..."
    (cd "$ROOT_DIR/backend" && npm install --silent) || die "npm install im Backend fehlgeschlagen"
    ok "Backend Dependencies installiert"
  else
    ok "Backend Dependencies vorhanden"
  fi
fi

if [ ! -d "$ROOT_DIR/frontend/node_modules" ]; then
  info "Installiere Frontend Dependencies..."
  (cd "$ROOT_DIR/frontend" && npm install --silent) || die "npm install im Frontend fehlgeschlagen"
  ok "Frontend Dependencies installiert"
else
  ok "Frontend Dependencies vorhanden"
fi

# ─── 5. Ports prüfen ─────────────────────────────────────
check_port() {
  local port=$1
  local name=$2
  if lsof -i :"$port" -sTCP:LISTEN &> /dev/null; then
    die "Port ${port} ist bereits belegt (benötigt für ${name}).

       Prüfe mit: lsof -i :${port}
       Beende den Prozess oder ändere den Port in der Konfiguration."
  fi
}

if [ "$MODE" != "--local" ]; then
  check_port 3000 "Backend"
fi
check_port 4200 "Frontend"
ok "Benötigte Ports sind frei"

# ─── 6. Cleanup bei Beendigung ───────────────────────────
cleanup() {
  echo ""
  info "Beende Prozesse..."
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
  ok "Alle Prozesse beendet"
}
trap cleanup EXIT INT TERM

# ─── 7. Backend starten (nur im Vollmodus) ───────────────
if [ "$MODE" != "--local" ]; then
  echo ""
  info "Starte Backend auf http://localhost:3000 ..."
  (cd "$ROOT_DIR/backend" && npm run dev) &
  BACKEND_PID=$!

  for i in {1..15}; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
      ok "Backend läuft (PID: $BACKEND_PID)"
      break
    fi
    if [ "$i" -eq 15 ]; then
      warn "Backend antwortet noch nicht – starte Frontend trotzdem"
    fi
    sleep 1
  done
fi

# ─── 8. Frontend starten ─────────────────────────────────
if [ "$MODE" = "--local" ]; then
  info "Starte Frontend auf http://localhost:4200 (Lokal-Modus) ..."
  (cd "$ROOT_DIR/frontend" && npx ng serve --port 4200 --configuration local) &
else
  info "Starte Frontend auf http://localhost:4200 ..."
  (cd "$ROOT_DIR/frontend" && npx ng serve --port 4200) &
fi
FRONTEND_PID=$!

# ─── 9. Fertig ───────────────────────────────────────────
echo ""
printf "${GREEN}${BOLD}══════════════════════════════════════════${NC}\n"
printf "${GREEN}${BOLD}  Timebooking gestartet!${NC}\n"
printf "${GREEN}${BOLD}══════════════════════════════════════════${NC}\n"
echo ""
printf "  Frontend:  ${BOLD}http://localhost:4200${NC}\n"
if [ "$MODE" != "--local" ]; then
printf "  Backend:   ${BOLD}http://localhost:3000${NC}\n"
printf "  Modus:     Google Calendar + manuelle Erfassung\n"
else
printf "  Modus:     ${YELLOW}Nur manuelle Zeiterfassung (kein Google Import)${NC}\n"
fi
echo ""
printf "  ${YELLOW}Strg+C${NC} zum Beenden\n"
echo ""

wait
