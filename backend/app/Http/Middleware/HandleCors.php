<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class HandleCors
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $origin = $this->getAllowedOrigin($request);
        
        // Handle preflight requests
        if ($request->isMethod('OPTIONS')) {
            return response('', 200)
                ->header('Access-Control-Allow-Origin', $origin)
                ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
                ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-TOKEN')
                ->header('Access-Control-Allow-Credentials', 'true')
                ->header('Access-Control-Max-Age', '86400');
        }

        $response = $next($request);

        // Add CORS headers to the response
        $response->headers->set('Access-Control-Allow-Origin', $origin);
        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
        $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-TOKEN');
        $response->headers->set('Access-Control-Allow-Credentials', 'true');

        return $response;
    }

    /**
     * Get the allowed origin for the request
     */
    private function getAllowedOrigin(Request $request): string
    {
        $allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:5173',
            'http://localhost:8080',
            'http://localhost:8081',
            'http://localhost:8082',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:5173',
            'http://127.0.0.1:8080',
            'http://127.0.0.1:8081',
            'http://127.0.0.1:8082',
            'http://192.168.56.1:3000',
            'http://192.168.56.1:5173',
            'http://192.168.56.1:8080',
            'http://192.168.56.1:8081',
            'http://192.168.56.1:8082',
            'http://192.168.100.6:3000',
            'http://192.168.100.6:5173',
            'http://192.168.100.6:5174',
            'http://192.168.100.6:5175',
            'http://192.168.100.6:8080',
            'http://192.168.100.6:8081',
            'http://192.168.100.6:8082',
            'http://10.173.7.92:3000',
            'http://10.173.7.92:5173',
            'http://10.173.7.92:8080',
            'http://10.173.7.92:8081',
            'http://10.173.7.92:8082',
            'http://10.35.44.92:3000',
            'http://10.35.44.92:5173',
            'http://10.35.44.92:5174',
            'http://10.35.44.92:8080',
            'http://10.35.44.92:8081',
            'http://10.35.44.92:8082',
            // Railway frontend domains
            'https://everbright-optical-clinic-system-production-2f77.up.railway.app',
            'https://everbright-optical-clinic-system-production.up.railway.app',
            // Allow any Railway subdomain
            'https://*.up.railway.app',
        ];

        $origin = $request->headers->get('Origin');
        
        // If no origin header, allow localhost as default
        if (!$origin) {
            return 'http://localhost:5173';
        }
        
        // Check exact match first
        if (in_array($origin, $allowedOrigins)) {
            return $origin;
        }
        
        // Check for local development patterns (localhost, 127.0.0.1, LAN IPs with any port)
        // Allow any HTTP origin from local network (for development)
        if ($origin && (
            preg_match('/^http:\/\/localhost(?:\:[0-9]+)?$/', $origin) ||
            preg_match('/^http:\/\/127\.0\.0\.1(?:\:[0-9]+)?$/', $origin) ||
            preg_match('/^http:\/\/192\.168\.[0-9]+\.[0-9]+(?:\:[0-9]+)?$/', $origin) ||
            preg_match('/^http:\/\/10\.[0-9]+\.[0-9]+\.[0-9]+(?:\:[0-9]+)?$/', $origin) ||
            preg_match('/^http:\/\/172\.(?:1[6-9]|2[0-9]|3[01])\.[0-9]+\.[0-9]+(?:\:[0-9]+)?$/', $origin)
        )) {
            return $origin;
        }
        
        // Check Railway subdomain pattern
        if ($origin && preg_match('/^https:\/\/.*\.up\.railway\.app$/', $origin)) {
            return $origin;
        }

        // For development, allow any localhost or LAN IP origin (more permissive patterns)
        if ($origin && (
            preg_match('/^http:\/\/localhost:\d+$/', $origin) ||
            preg_match('/^http:\/\/127\.0\.0\.1:\d+$/', $origin) ||
            preg_match('/^http:\/\/192\.168\.\d+\.\d+:\d+$/', $origin) ||
            preg_match('/^http:\/\/10\.\d+\.\d+\.\d+:\d+$/', $origin) ||
            preg_match('/^http:\/\/172\.(?:1[6-9]|2[0-9]|3[01])\.\d+\.\d+:\d+$/', $origin)
        )) {
            return $origin;
        }

        // If we have an origin but it didn't match, log it for debugging (only in development)
        if ($origin && config('app.debug')) {
            \Log::warning('CORS: Origin not matched', ['origin' => $origin]);
        }

        // Default to the first allowed origin if no match
        // But if we have an origin from a local network, return it anyway for development
        if ($origin && preg_match('/^http:\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(?:1[6-9]|2[0-9]|3[01])\.)/', $origin)) {
            return $origin;
        }

        return $allowedOrigins[0];
    }
}
