@echo off
cd /d "%~dp0"
where node >nul 2>nul
IF ERRORLEVEL 1 (
  echo Node.js is required. Opening official download page...
  start https://nodejs.org/en/download
  pause
  exit /b
)
echo Starting AMTEK Traffic Ops...
start "AMTEK Traffic Ops" http://localhost:3001
node server/index.js
pause
