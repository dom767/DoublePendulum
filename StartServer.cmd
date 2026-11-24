@echo off
rem Start this app's dev server (AgentController standards/guidelines/start-scripts.md).
rem Uses %PORT% if set (agents), otherwise the app's reserved default from ports.md.
rem serve.mjs is a dependency-free static server, so starting needs no network.
setlocal
cd /d "%~dp0"

rem Change this to the app's reserved default port.
if not defined PORT set PORT=7100

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is needed to run the dev server. Install the LTS version from https://nodejs.org and try again.
  if not defined AC_NO_PAUSE pause
  exit /b 1
)

node serve.mjs %PORT%
set EXIT=%ERRORLEVEL%
rem serve.mjs exits 2 when this app is already on PORT.
if %EXIT% equ 2 (
  if not defined AC_NO_PAUSE pause
  exit /b 0
)
if %EXIT% neq 0 (
  if not defined AC_NO_PAUSE pause
  exit /b %EXIT%
)

