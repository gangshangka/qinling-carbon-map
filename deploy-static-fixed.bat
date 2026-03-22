@echo off
chcp 65001 > nul
echo ========================================
echo  秦岭碳汇静态立体地图 - 调试版本
echo ========================================
echo.

echo [步骤1] 检查Python环境...
python --version
if errorlevel 1 (
    echo [错误] 未找到Python，请先安装Python 3.x
    pause
    exit /b 1
)

echo [步骤2] 检查必要文件...
if not exist "static-3d-map.html" (
    echo [错误] 找不到static-3d-map.html文件
    pause
    exit /b 1
) else (
    echo  ✓ 找到static-3d-map.html
)

if not exist "data\map3d_sampled.json" (
    echo [警告] 找不到data\map3d_sampled.json，将使用模拟数据
    timeout /t 2 > nul
) else (
    echo  ✓ 找到data\map3d_sampled.json
)

if not exist "data\shapefile\qinling.geojson" (
    echo [警告] 找不到data\shapefile\qinling.geojson，地图轮廓将无法显示
    timeout /t 2 > nul
) else (
    echo  ✓ 找到data\shapefile\qinling.geojson
)

echo [步骤3] 检查端口占用...
netstat -ano | findstr :8000 > nul
if not errorlevel 1 (
    echo [警告] 端口8000已被占用，尝试使用端口8080
    set PORT=8080
) else (
    echo  ✓ 端口8000可用
    set PORT=8000
)

echo [步骤4] 获取本地IP地址...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4"') do (
    set "IP=%%a"
    goto :found_ip
)
:found_ip
set IP=%IP:~1%
echo  ✓ 本地IP地址: %IP%

echo [步骤5] 打开浏览器...
start "" "http://localhost:%PORT%/static-3d-map.html"
echo  已打开浏览器: http://localhost:%PORT%/static-3d-map.html

echo [步骤6] 启动HTTP服务器...
echo.
echo ========================================
echo  服务器运行中...
echo  本地访问: http://localhost:%PORT%/static-3d-map.html
echo  网络访问: http://%IP%:%PORT%/static-3d-map.html
echo  按 Ctrl+C 停止服务器
echo ========================================
echo.

python -m http.server %PORT%

if errorlevel 1 (
    echo.
    echo [错误] 无法启动HTTP服务器
    echo 可能的原因:
    echo  1. Python模块问题
    echo  2. 端口%PORT%也被占用
    echo  3. 防火墙阻止
    echo.
    echo 请尝试:
    echo  1. 手动运行: python -m http.server 9000
    echo  2. 然后在浏览器访问: http://localhost:9000/static-3d-map.html
    pause
)