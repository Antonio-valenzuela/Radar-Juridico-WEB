#!/bin/sh
set -e

echo "Ejecutando migraciones..."
npx prisma migrate deploy

echo "Iniciando workers..."
npx tsx worker/ingestWorker.ts &
INGEST_PID=$!

npx tsx worker/legalReportWorker.ts &
REPORT_PID=$!

npx tsx worker/dashboardWorker.ts &
DASHBOARD_PID=$!

cleanup() {
  echo "Apagando workers..."
  kill $INGEST_PID $REPORT_PID $DASHBOARD_PID 2>/dev/null || true
}

trap cleanup INT TERM

echo "Iniciando Next.js..."
npm run start
