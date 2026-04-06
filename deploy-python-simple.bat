@echo off
echo ========================================
echo Python TIF Processor Minimal Deployment
echo ========================================

echo.
echo [1/3] Checking directory...
if not exist "cloudfunctions\tif-processor-python-minimal\index.py" (
    echo ERROR: Python minimal cloud function directory not found!
    pause
    exit /b 1
)

echo.
echo [2/3] Deployment instructions:
echo.
echo 1. Open WeChat Developer Tools
echo 2. Click "Cloud Development" on left sidebar
echo 3. Go to "Cloud Functions" page
echo 4. If "tif-processor" exists, delete it first
echo 5. Click "New Cloud Function"
echo 6. Function name: tif-processor
echo 7. Runtime: Python 3.7
echo 8. Upload method: Local folder
echo 9. Select folder: cloudfunctions\tif-processor-python-minimal\
echo 10. Click "OK" to upload
echo.
echo 11. Wait for deployment (1-2 minutes)
echo 12. Status should show "Running"
echo.
echo 13. Test with sample event:
echo    {
echo      "fileID": "cloud://cloudbase-8gdof83j7fdc6094/qinling-carbon-data/tif/2024_1.tif",
echo      "year": 2024,
echo      "month": 1,
echo      "fileName": "nep202401.tif"
echo    }
echo.
echo [3/3] Important notes:
echo.
echo * This version uses tifffile (pure Python) instead of rasterio
echo * Dependencies should install automatically
echo * If installation fails, check requirements.txt
echo.
echo Press any key to exit...
pause >nul