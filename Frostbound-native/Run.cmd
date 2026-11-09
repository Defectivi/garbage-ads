@echo off
setlocal
cd /d "%~dp0"
if exist ".tools\cargo\bin\cargo.exe" (
  set "CARGO_HOME=%~dp0.tools\cargo"
  set "RUSTUP_HOME=%~dp0.tools\rustup"
  set "PATH=%~dp0.tools\cargo\bin;%PATH%"
)
cargo.exe run -p frostbound-desktop --locked -- %*
exit /b %errorlevel%
