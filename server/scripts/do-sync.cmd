@echo off
REM ============================================
REM Sync EasyTracker -> Railway
REM Uso:  cd C:\Dash-Prab\trafficboard\server
REM       scripts\do-sync.cmd
REM ============================================
cd /d "%~dp0"
set SYNC_SECRET=73c18ce56186e5d221b59e1f559dfaf5f92f7b5030b342511c0f45b5ac863310
set RAILWAY_URL=https://dash-prab-production.up.railway.app
npx tsx scripts/do-sync.ts
pause