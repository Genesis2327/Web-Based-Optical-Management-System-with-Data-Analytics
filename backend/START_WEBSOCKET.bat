@echo off
setlocal enabledelayedexpansion
echo ========================================
echo EverBright Optical - WebSocket Server
echo ========================================
echo.

cd /d "%~dp0"

REM Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if websocket directory exists
if not exist "websocket" (
    echo [ERROR] websocket directory not found
    pause
    exit /b 1
)

cd websocket

REM Check if node_modules exists, if not install dependencies
if not exist "node_modules" (
    echo Installing WebSocket server dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Get network IP for display
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set IP=%%a
    set IP=!IP:~1!
    goto :found_ip
)
:found_ip

echo.
echo [OK] Starting WebSocket server...
echo WebSocket server will be accessible from:
echo   - ws://localhost:6001
echo   - ws://127.0.0.1:6001
if defined IP (
    echo   - ws://%IP%:6001
) else (
    echo   - ws://[YOUR_NETWORK_IP]:6001
)
echo.
echo Health check: http://localhost:6001/health
echo Connections: http://localhost:6001/connections
echo.
echo IMPORTANT: Keep this window OPEN!
echo Press Ctrl+C to stop the server
echo ========================================
echo.

REM Start the WebSocket server
call npm start

pause

