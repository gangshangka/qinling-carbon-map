@echo off
chcp 65001 > nul
echo ========================================
echo  秦岭碳汇静态立体地图 - 本地部署工具
echo ========================================
echo.

REM 检查Python是否可用
python --version > nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到Python，请先安装Python 3.x
    pause
    exit /b 1
)

REM 检查必要文件
if not exist "static-3d-map.html" (
    echo [错误] 找不到static-3d-map.html文件
    pause
    exit /b 1
)

if not exist "data\map3d_sampled.json" (
    echo [警告] 找不到data\map3d_sampled.json，将使用模拟数据
    echo 如需生成真实数据，请运行: python sample_tiff_values.py
    timeout /t 3 > nul
)

if not exist "data\shapefile\qinling.geojson" (
    echo [警告] 找不到data\shapefile\qinling.geojson，地图轮廓将无法显示
    timeout /t 3 > nul
)

REM 获取本地IP地址
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4"') do (
    set "IP=%%a"
    goto :found_ip
)
:found_ip
set IP=%IP:~1%

REM 启动HTTP服务器并打开浏览器
start "" "http://localhost:8000/static-3d-map.html"
start "" "http://%IP%:8000/static-3d-map.html"

echo.
echo [信息] 启动本地HTTP服务器...
echo [信息] 本地访问: http://localhost:8000/static-3d-map.html
echo [信息] 网络访问: http://%IP%:8000/static-3d-map.html
echo [信息] 按 Ctrl+C 停止服务器
echo.

REM 启动Python HTTP服务器
python -m http.server 8000

if errorlevel 1 (
    echo.
    echo [错误] 无法启动HTTP服务器，端口8000可能被占用
    echo 请尝试: python -m http.server 8080
    pause
)