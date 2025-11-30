@echo off
echo ========================================
echo Importing everbright_optical Database
echo ========================================
echo.

REM Check if MySQL/MariaDB is in PATH
where mysql >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: MySQL/MariaDB is not in your PATH.
    echo Please add MySQL/MariaDB bin directory to your PATH or use full path.
    echo.
    echo Example: C:\xampp\mysql\bin\mysql.exe
    pause
    exit /b 1
)

REM Get database credentials from .env or use defaults
set DB_HOST=127.0.0.1
set DB_PORT=3306
set DB_USERNAME=root
set DB_PASSWORD=
set DB_DATABASE=everbright_optical

REM Check if .env file exists and read values
if exist .env (
    echo Reading database configuration from .env...
    for /f "tokens=2 delims==" %%a in ('findstr /C:"DB_HOST" .env') do set DB_HOST=%%a
    for /f "tokens=2 delims==" %%a in ('findstr /C:"DB_PORT" .env') do set DB_PORT=%%a
    for /f "tokens=2 delims==" %%a in ('findstr /C:"DB_USERNAME" .env') do set DB_USERNAME=%%a
    for /f "tokens=2 delims==" %%a in ('findstr /C:"DB_PASSWORD" .env') do set DB_PASSWORD=%%a
    for /f "tokens=2 delims==" %%a in ('findstr /C:"DB_DATABASE" .env') do set DB_DATABASE=%%a
)

echo.
echo Database Configuration:
echo   Host: %DB_HOST%
echo   Port: %DB_PORT%
echo   Username: %DB_USERNAME%
echo   Database: %DB_DATABASE%
echo.

REM Get SQL file path
set SQL_FILE=%~dp0..\..\Downloads\everbright_optical (2).sql

if not exist "%SQL_FILE%" (
    echo ERROR: SQL file not found at:
    echo   %SQL_FILE%
    echo.
    echo Please make sure the SQL file exists or update the path in this script.
    pause
    exit /b 1
)

echo SQL File: %SQL_FILE%
echo.

REM Create database if it doesn't exist
echo Creating database if it doesn't exist...
mysql -h%DB_HOST% -P%DB_PORT% -u%DB_USERNAME% %DB_PASSWORD% -e "CREATE DATABASE IF NOT EXISTS %DB_DATABASE% CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Could not create database. It may already exist or there's a connection issue.
    echo Continuing with import...
)

echo.
echo Importing SQL file...
echo This may take a few minutes...
echo.

REM Import SQL file
if "%DB_PASSWORD%"=="" (
    mysql -h%DB_HOST% -P%DB_PORT% -u%DB_USERNAME% %DB_DATABASE% < "%SQL_FILE%"
) else (
    mysql -h%DB_HOST% -P%DB_PORT% -u%DB_USERNAME% -p%DB_PASSWORD% %DB_DATABASE% < "%SQL_FILE%"
)

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Database imported successfully!
    echo ========================================
    echo.
    echo Next steps:
    echo 1. Make sure your .env file has:
    echo    DB_DATABASE=everbright_optical
    echo 2. Run: php artisan config:clear
    echo 3. Test the connection: php artisan tinker
    echo    Then type: DB::connection()-^>getPdo();
    echo.
) else (
    echo.
    echo ========================================
    echo ERROR: Database import failed!
    echo ========================================
    echo.
    echo Please check:
    echo 1. MySQL/MariaDB is running
    echo 2. Database credentials are correct
    echo 3. SQL file path is correct
    echo 4. You have permission to create/import to the database
    echo.
)

pause


