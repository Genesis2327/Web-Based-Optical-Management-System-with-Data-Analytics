@echo off
setlocal enabledelayedexpansion
echo ========================================
echo Server Status Check
echo ========================================
echo.

cd /d "%~dp0"

REM Check if PHP is available
where php >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [FAIL] PHP is not installed or not in PATH
    pause
    exit /b 1
)
echo [OK] PHP is installed

REM Get network IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set IP=%%a
    set IP=!IP:~1!
    goto :found_ip
)
:found_ip

REM Check if server is running on port 8000
echo.
echo Checking if server is running on port 8000...
netstat -an | findstr ":8000" | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Port 8000 is in use (server may be running)
    echo.
    echo Testing server response...
    
    REM Test localhost
    curl -s http://localhost:8000/api/health >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo [OK] Server is responding at http://localhost:8000
    ) else (
        echo [WARNING] Server not responding at localhost:8000
    )
    
    REM Test network IP if available
    if defined IP (
        curl -s http://%IP%:8000/api/health >nul 2>&1
        if %ERRORLEVEL% EQU 0 (
            echo [OK] Server is responding at http://%IP%:8000
        ) else (
            echo [WARNING] Server not responding at http://%IP%:8000
            echo          (May be firewall issue or server only listening on localhost)
        )
    )
    
    echo.
    echo Server process info:
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
        echo   Process ID: %%a
        tasklist /FI "PID eq %%a" /FO LIST | findstr "Image Name"
    )
) else (
    echo [INFO] Port 8000 is not in use (server is not running)
    echo.
    echo To start the server, run:
    echo   START_SERVER_HERE.bat
    echo   OR
    echo   RUN_AUTO_FIX.bat
)

if defined IP (
    echo.
    echo Your network IP: %IP%
    echo Frontend should connect to: http://%IP%:8000
)

echo.
echo ========================================
echo Status check complete
echo ========================================
pause

