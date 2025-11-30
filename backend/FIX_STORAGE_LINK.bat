@echo off
echo ========================================
echo FIXING STORAGE SYMLINK
echo ========================================
echo.

REM Check if public/storage exists and is a directory
if exist "public\storage" (
    echo Found public/storage...
    echo Checking if it's a symlink...
    
    REM On Windows, we need to check if it's a junction or symlink
    REM For now, we'll just remove it and recreate as a symlink
    echo Removing existing public/storage...
    rmdir /s /q "public\storage" 2>nul
    
    if exist "public\storage" (
        echo ERROR: Could not remove public/storage directory.
        echo Please manually delete public\storage and run: php artisan storage:link
        pause
        exit /b 1
    )
)

echo Creating storage symlink...
php artisan storage:link

if %ERRORLEVEL% EQU 0 (
    echo.
    echo SUCCESS: Storage symlink created!
    echo.
    echo Verifying...
    if exist "public\storage" (
        echo ✓ public/storage exists
    ) else (
        echo ✗ public/storage does not exist
    )
) else (
    echo.
    echo ERROR: Failed to create storage symlink
    echo.
    echo Alternative method: Create a junction link manually
    echo Run this command as Administrator:
    echo mklink /J "public\storage" "storage\app\public"
)

echo.
pause

