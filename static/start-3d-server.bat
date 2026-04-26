@echo off
chcp 65001 >nul
echo ========================================
echo   秦岭碳汇 3D 地图 - 本地服务器
echo ========================================
echo.
echo 正在启动 HTTP 服务器...
echo 启动后请在浏览器访问：
echo.
echo   http://localhost:8080/qinling-3d-cesium.html
echo.
echo 按 Ctrl+C 停止服务器
echo ========================================
echo.
cd /d "%~dp0"
python -m http.server 8080
