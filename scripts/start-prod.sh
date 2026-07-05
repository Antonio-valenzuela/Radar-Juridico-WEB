#!/bin/sh
set -e

echo "Ejecutando migraciones..."
npx prisma migrate deploy

PIDS=""

if [ "${ENABLE_WORKERS}" != "false" ]; then
  echo "Iniciando workers..."

  if [ "${ENABLE_AUTO_INGEST}" != "false" ]; then
    npx tsx worker/ingestWorker.ts &
    INGEST_PID=$!
    PIDS="$PIDS $INGEST_PID"
  else
    echo "Ingest worker deshabilitado (ENABLE_AUTO_INGEST=false)"
  fi

  npx tsx worker/legalReportWorker.ts &
  REPORT_PID=$!
  PIDS="$PIDS $REPORT_PID"

  if [ "${ENABLE_DASHBOARD_WS}" != "false" ]; then
    npx tsx worker/dashboardWorker.ts &
    DASHBOARD_PID=$!
    PIDS="$PIDS $DASHBOARD_PID"
  else
    echo "Dashboard WS worker deshabilitado (ENABLE_DASHBOARD_WS=false)"
  fi
else
  echo "Todos los workers pesados deshabilitados (ENABLE_WORKERS=false)"
fi

cleanup() {
  echo "Apagando workers..."
  if [ -n "$PIDS" ]; then
    kill $PIDS 2>/dev/null || true
  fi
}

trap cleanup INT TERM

echo "Iniciando Next.js..."
npm run start
