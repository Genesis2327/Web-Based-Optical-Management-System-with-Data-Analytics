@echo off
echo ===========================================
echo EverBright Optical Clinic System
echo Full Database Import Script
echo ===========================================
echo.

REM Check if MySQL is available
mysql --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: MySQL client is not installed or not in PATH
    echo Please install MySQL and add it to your PATH
    pause
    exit /b 1
)

echo MySQL client found successfully.
echo.

REM Get database credentials
set /p DB_HOST="Enter database host (default: 127.0.0.1): "
if "%DB_HOST%"=="" set DB_HOST=127.0.0.1

set /p DB_PORT="Enter database port (default: 3306): "
if "%DB_PORT%"=="" set DB_PORT=3306

set /p DB_NAME="Enter database name (default: everbright_optical): "
if "%DB_NAME%"=="" set DB_NAME=everbright_optical

set /p DB_USER="Enter database username: "
if "%DB_USER%"=="" (
    echo ERROR: Database username is required
    pause
    exit /b 1
)

REM Get database password securely (hidden input)
echo Enter database password:
for /f "delims=" %%i in ('powershell -command "$password = Read-Host -AsSecureString; [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))"') do set DB_PASS=%%i

echo.
echo ===========================================
echo Database Configuration
echo ===========================================
echo Host: %DB_HOST%
echo Port: %DB_PORT%
echo Database: %DB_NAME%
echo User: %DB_USER%
echo ===========================================
echo.

REM Check if database exists, create if it doesn't
echo Checking if database exists...
mysql -h%DB_HOST% -P%DB_PORT% -u%DB_USER% -p%DB_PASS% -e "CREATE DATABASE IF NOT EXISTS %DB_NAME% CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>nul

if %errorlevel% neq 0 (
    echo ERROR: Failed to create/check database. Please check your credentials and permissions.
    echo Make sure the MySQL server is running and you have CREATE DATABASE privileges.
    pause
    exit /b 1
)

echo Database check/create completed successfully.
echo.

REM Import the database
echo Starting database import...
echo This may take several minutes depending on the data size...
echo.

REM Check if the SQL file exists in the same directory
if not exist "full_database_backup.sql" (
    echo ERROR: full_database_backup.sql file not found in the current directory.
    echo Please make sure the SQL dump file is named 'full_database_backup.sql' and placed in the project root.
    pause
    exit /b 1
)

mysql -h%DB_HOST% -P%DB_PORT% -u%DB_USER% -p%DB_PASS% %DB_NAME% < full_database_backup.sql 2>nul

if %errorlevel% neq 0 (
    echo ERROR: Database import failed. Please check:
    echo 1. Database connection and credentials
    echo 2. SQL file integrity
    echo 3. Sufficient disk space
    echo 4. MySQL server is running
    pause
    exit /b 1
)

echo.
echo ===========================================
echo SUCCESS: Database import completed!
echo ===========================================
echo.
echo Next steps:
echo 1. Configure your .env file with database settings
echo 2. Run: php artisan config:clear
echo 3. Run: php artisan cache:clear
echo 4. Run: php artisan storage:link
echo 5. Run: php artisan migrate:status (to verify)
echo.
echo Your application should now be ready to use!
echo.

REM Optional: Offer to run additional setup commands
set /p RUN_SETUP="Do you want to run additional Laravel setup commands? (y/n): "
if /i "%RUN_SETUP%"=="y" (
    echo Running Laravel setup commands...
    if exist "artisan" (
        php artisan config:clear
        php artisan cache:clear
        php artisan storage:link
        echo.
        echo Laravel setup completed!
    ) else (
        echo WARNING: artisan file not found. Please run the Laravel setup commands manually:
        echo php artisan config:clear
        echo php artisan cache:clear
        echo php artisan storage:link
    )
)

echo.
echo Import process completed successfully!
pause
