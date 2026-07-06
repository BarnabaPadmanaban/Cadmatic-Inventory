#!/bin/bash
set -e

echo ""
echo "============================================="
echo "  NUCLEAR EMS - Equipment Monitoring System  "
echo "============================================="
echo ""

# Check Node
if ! command -v node &>/dev/null; then
  echo "[ERROR] Node.js not found. Install from https://nodejs.org"
  exit 1
fi
echo "[OK] Node.js $(node --version)"

# Backend
echo ""
echo "[1/4] Installing backend dependencies..."
cd backend
[ ! -d node_modules ] && npm install

if [ ! -f .env ]; then
  cp .env.example .env
  echo "[WARN] Created .env from .env.example"
  echo "[ACTION] Edit backend/.env with your SQL Server details, then re-run."
  exit 1
fi

echo "[2/4] Running database migrations..."
node src/migrations/runMigrations.js

echo "[3/4] Starting backend..."
npm run dev &
BACKEND_PID=$!
echo "[OK] Backend PID: $BACKEND_PID"

# Frontend
cd ../frontend
echo ""
echo "[4/4] Installing & starting frontend..."
[ ! -d node_modules ] && npm install
npm start &
FRONTEND_PID=$!

echo ""
echo "============================================="
echo " Backend  -> http://localhost:5000"
echo " Frontend -> http://localhost:3000"
echo " Press Ctrl+C to stop all servers"
echo "============================================="

wait $BACKEND_PID $FRONTEND_PID
