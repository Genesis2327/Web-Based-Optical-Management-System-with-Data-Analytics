# Import Database Instructions

## Quick Import (Windows)

1. **Run the import script:**
   ```
   cd backend
   IMPORT_DATABASE.bat
   ```

2. **Or manually import via phpMyAdmin:**
   - Open phpMyAdmin (http://localhost/phpmyadmin)
   - Create database `everbright_optical` (if it doesn't exist)
   - Select the database
   - Click "Import" tab
   - Choose file: `C:\Users\admin\Downloads\everbright_optical (2).sql`
   - Click "Go"

3. **Or manually import via MySQL command line:**
   ```bash
   mysql -u root -p everbright_optical < "C:\Users\admin\Downloads\everbright_optical (2).sql"
   ```

## Configure Laravel

1. **Update your `.env` file** (create it from `.env.example` if needed):
   ```env
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=everbright_optical
   DB_USERNAME=root
   DB_PASSWORD=
   ```

2. **Clear Laravel config cache:**
   ```bash
   php artisan config:clear
   php artisan cache:clear
   ```

3. **Test the connection:**
   ```bash
   php artisan tinker
   ```
   Then type:
   ```php
   DB::connection()->getPdo();
   ```
   If it returns a PDO object, the connection is working!

## Verify Database

Check that your database has data:
```bash
php artisan tinker
```
```php
DB::table('users')->count();
DB::table('products')->count();
DB::table('appointments')->count();
```

## Important Notes

- The SQL file uses database name: `everbright_optical`
- Make sure MySQL/MariaDB is running before importing
- The import script will automatically create the database if it doesn't exist
- After importing, you may need to run migrations for any new tables:
  ```bash
  php artisan migrate
  ```


