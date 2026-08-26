@echo off
cd /d "%~dp0"
echo Starting Pan Santos Donate Queue...
call npm.cmd install
call npm.cmd start
pause
