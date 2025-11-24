# CORS Error Troubleshooting Guide

## Understanding the Error

The error message indicates:
- **Frontend**: `http://localhost:5173` (Vite dev server)
- **Backend API**: `http://127.0.0.1:8000/api/receipts`
- **Problem**: Request is being redirected to `http://localhost:5173/` instead of reaching the backend

## Root Causes

### 1. Backend Server Not Running
The most common cause is that the Laravel backend is not running on port 8000.

**Solution:**
```bash
cd backend
php artisan serve
# Or specify the host and port explicitly:
php artisan serve --host=127.0.0.1 --port=8000
```

### 2. Authentication Redirect
If the route requires authentication and the user is not logged in, Laravel might redirect.

**Solution:**
- Ensure you're sending the authentication token in the request headers:
  ```javascript
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
  ```

### 3. Route Not Found
If the route doesn't exist, Laravel might redirect.

**Solution:**
- Check that the route exists in `backend/routes/api.php`
- Verify the route is accessible: `GET http://127.0.0.1:8000/api/receipts`

### 4. CORS Configuration
The CORS middleware should allow requests from `http://localhost:5173`.

**Solution:**
- The CORS configuration in `backend/config/cors.php` already includes `http://localhost:5173`
- The `HandleCors` middleware is registered in `bootstrap/app.php`

## Quick Fixes

### Fix 1: Verify Backend is Running
```bash
# In backend directory
php artisan serve --host=127.0.0.1 --port=8000
```

### Fix 2: Test API Endpoint Directly
Open in browser or use curl:
```bash
curl http://127.0.0.1:8000/api/receipts
# Should return JSON (even if error, should be JSON, not HTML redirect)
```

### Fix 3: Check Browser Console
Look for:
- Network tab: Check if request is actually going to `127.0.0.1:8000`
- Response headers: Should include `Access-Control-Allow-Origin`

### Fix 4: Verify Frontend API URL
Check `frontend--/src/config/api.ts` - it should use `http://127.0.0.1:8000/api` for localhost

## Testing Steps

1. **Start Backend Server:**
   ```bash
   cd backend
   php artisan serve --host=127.0.0.1 --port=8000
   ```

2. **Test API Endpoint:**
   ```bash
   curl -H "Accept: application/json" http://127.0.0.1:8000/api/receipts
   ```

3. **Check CORS Headers:**
   ```bash
   curl -H "Origin: http://localhost:5173" \
        -H "Access-Control-Request-Method: GET" \
        -X OPTIONS \
        http://127.0.0.1:8000/api/receipts \
        -v
   ```
   Should see `Access-Control-Allow-Origin: http://localhost:5173` in response

4. **Test from Frontend:**
   - Open browser DevTools → Network tab
   - Make the request from frontend
   - Check if request goes to `127.0.0.1:8000` or gets redirected

## Common Issues

### Issue: Request Redirects to Frontend
**Cause:** Backend not running or route doesn't exist
**Fix:** Start backend server and verify route exists

### Issue: CORS Error Even After Fix
**Cause:** Browser cached the error
**Fix:** Clear browser cache or use incognito mode

### Issue: 401 Unauthorized
**Cause:** Missing or invalid authentication token
**Fix:** Ensure token is sent in `Authorization` header

### Issue: 404 Not Found
**Cause:** Route doesn't exist or wrong URL
**Fix:** Check `backend/routes/api.php` for correct route

## Debugging

Enable debug logging in Laravel:
```php
// backend/config/app.php
'debug' => true,
'log_level' => 'debug',
```

Check Laravel logs:
```bash
tail -f backend/storage/logs/laravel.log
```

## Still Having Issues?

1. Check if backend is actually running:
   ```bash
   netstat -an | findstr :8000  # Windows
   lsof -i :8000                # Mac/Linux
   ```

2. Try accessing backend directly:
   - Open `http://127.0.0.1:8000/api/receipts` in browser
   - Should see JSON response (not HTML redirect)

3. Check firewall/antivirus:
   - Some security software blocks localhost connections

4. Try different port:
   ```bash
   php artisan serve --port=8001
   ```
   Then update frontend config to use port 8001

