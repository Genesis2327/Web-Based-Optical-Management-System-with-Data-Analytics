@echo off
setlocal enabledelayedexpansion
echo ========================================
echo EverBright Optical - Quick Server Start
echo ========================================
echo.

cd /d "%~dp0"

REM Quick start - minimal checks
where php >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PHP is not installed or not in PATH
    pause
    exit /b 1
)

REM Kill any existing server on port 8000
echo Checking port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo Stopping existing process on port 8000 (PID %%a)...
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 >nul

REM Get network IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set IP=%%a
    set IP=!IP:~1!
    goto :found_ip
)
:found_ip

echo.
echo [OK] Starting server...
echo Server will be accessible from:
echo   - http://localhost:8000
echo   - http://127.0.0.1:8000
if defined IP (
    echo   - http://%IP%:8000
) else (
    echo   - http://[YOUR_NETWORK_IP]:8000
)
echo.
echo IMPORTANT: Keep this window OPEN!
echo Press Ctrl+C to stop the server
echo ========================================
echo.

REM Start the server on all interfaces
php artisan serve --host=0.0.0.0 --port=8000

pause

