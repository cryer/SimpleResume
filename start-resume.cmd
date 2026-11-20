@echo off
setlocal
if exist "%~dp0.local-tex\TinyTeX\bin\windows\xelatex.exe" set "PATH=%~dp0.local-tex\TinyTeX\bin\windows;%PATH%"
set "APP=%~dp0src-tauri\target\release\resume-studio.exe"
if not exist "%APP%" (
  echo Build the desktop app first: npm run desktop:build -- --no-bundle
  exit /b 1
)
start "Resume Studio" "%APP%"
