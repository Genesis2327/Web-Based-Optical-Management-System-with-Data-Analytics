@echo off
echo ========================================
echo System Cleanup Script
echo ========================================
echo.
echo This will remove:
echo   - Test scripts (test-db-connection.php, add-skus-to-products.php)
echo   - Temporary SQL files
echo   - Laravel cache files
echo   - Laravel log files (cleared, not deleted)
echo   - Frontend build artifacts (dist folder)
echo.
set /p confirm="Continue? (Y/N): "
if /i not "%confirm%"=="Y" (
    echo Cleanup cancelled.
    pause
    exit /b 0
)

echo.
echo Starting cleanup...
echo.

REM Remove test scripts
echo [1/6] Removing test scripts...
if exist test-db-connection.php (
    del /f /q test-db-connection.php
    echo   ✓ Removed test-db-connection.php
)
if exist add-skus-to-products.php (
    del /f /q add-skus-to-products.php
    echo   ✓ Removed add-skus-to-products.php
)

REM Remove temporary SQL files (keep .example files)
echo.
echo [2/6] Removing temporary SQL files...
if exist descriptions.sql (
    del /f /q descriptions.sql
    echo   ✓ Removed descriptions.sql
)
if exist product_descriptions_update.sql (
    del /f /q product_descriptions_update.sql
    echo   ✓ Removed product_descriptions_update.sql
)

REM Clear Laravel cache
echo.
echo [3/6] Clearing Laravel cache...
cd backend
if exist bootstrap\cache\*.php (
    del /f /q bootstrap\cache\*.php 2>nul
    echo   ✓ Cleared bootstrap cache
)
if exist storage\framework\cache\* (
    del /f /q /s storage\framework\cache\* 2>nul
    echo   ✓ Cleared framework cache
)
if exist storage\framework\sessions\* (
    del /f /q /s storage\framework\sessions\* 2>nul
    echo   ✓ Cleared session files
)
if exist storage\framework\views\* (
    del /f /q /s storage\framework\views\* 2>nul
    echo   ✓ Cleared compiled views
)

REM Clear log files (keep the file, just clear content)
echo.
echo [4/6] Clearing log files...
if exist storage\logs\laravel.log (
    echo. > storage\logs\laravel.log
    echo   ✓ Cleared laravel.log
)

REM Clear frontend build artifacts
echo.
echo [5/6] Removing frontend build artifacts...
cd ..\frontend--
if exist dist (
    rmdir /s /q dist
    echo   ✓ Removed dist folder (can be regenerated with npm run build)
)

REM Optional: Clear node_modules (commented out - uncomment if needed)
REM echo.
REM echo [6/6] Removing node_modules (optional)...
REM set /p clearNode="Remove node_modules? This will require 'npm install' to restore. (Y/N): "
REM if /i "%clearNode%"=="Y" (
REM     if exist node_modules (
REM         rmdir /s /q node_modules
REM         echo   ✓ Removed node_modules
REM     )
REM     if exist package-lock.json (
REM         del /f /q package-lock.json
REM         echo   ✓ Removed package-lock.json
REM     )
REM )

echo.
echo ========================================
echo Cleanup Complete!
echo ========================================
echo.
echo Next steps:
echo   1. Run: php artisan config:clear
echo   2. Run: php artisan cache:clear
echo   3. Run: php artisan view:clear
echo   4. (Frontend) Run: npm run build (if you removed dist)
echo.
pause


