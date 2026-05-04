@echo off
cd /d "%~dp0"
echo This will remove installed dependencies only. Your app/data files remain.
rmdir /s /q node_modules 2>nul
del package-lock.json 2>nul
echo Done.
pause
