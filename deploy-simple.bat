@echo off
chcp 65001 > nul

echo ========================================
echo   Qinling Carbon 3D Static Map
echo ========================================
echo.

echo [1] Check Python...
python --version > nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found
    pause
    exit /b 1
)

echo [2] Check files...
if not exist "static-3d-map.html" (
    echo ERROR: static-3d-map.html not found
    pause
    exit /b 1
)

echo [3] Start server on port 9000...
echo.
echo Server starting...
echo Open browser: http://localhost:9000/static-3d-map.html
echo Press Ctrl+C to stop
echo.

start "" "http://localhost:9000/static-3d-map.html"
python -m http.server 9000

if errorlevel 1 (
    echo ERROR: Server failed
    echo Try: python -m http.server 9999
    pause
)