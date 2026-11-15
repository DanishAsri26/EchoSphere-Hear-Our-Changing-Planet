@echo off
REM Start EchoSphere locally (needs Python). Then open http://localhost:8000
cd /d "%~dp0web"
start "" http://localhost:8000
python -m http.server 8000
