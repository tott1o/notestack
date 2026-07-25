@echo off
title NoteStack Desktop App Launcher
echo Starting NoteStack Desktop Application...
cd /d "%~dp0"
npm run electron:start
