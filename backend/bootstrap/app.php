<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

// Note: Throwable is a built-in PHP interface and does not need to be imported

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Disable sessions for web routes to avoid file permission issues
        $middleware->web(prepend: [
            \App\Http\Middleware\DisableSessions::class,
        ]);

        // Enable CORS middleware for API routes
        $middleware->api(prepend: [
            \App\Http\Middleware\HandleCors::class,
        ]);

        $middleware->alias([
            'auth' => \App\Http\Middleware\Authenticate::class,
            'verified' => \Illuminate\Auth\Middleware\EnsureEmailIsVerified::class,
            'role' => \App\Http\Middleware\CheckRole::class,
            'rate.api' => \App\Http\Middleware\RateLimitApi::class,
            'admin' => \App\Http\Middleware\EnsureAdmin::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Handle authentication exceptions for API routes - return JSON instead of redirect
        // This prevents Laravel from trying to generate a 'login' route URL
        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, \Illuminate\Http\Request $request) {
            // Always return JSON for API routes, never try to redirect
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'message' => 'Unauthenticated.',
                    'error' => 'Authentication required. Please provide a valid token.'
                ], 401)->header('Content-Type', 'application/json');
            }
            
            // For web routes, return null to use default behavior (but we don't have a login route)
            return null;
        });
        
        // Handle route not found exceptions (including when trying to generate login route)
        $exceptions->render(function (\Symfony\Component\Routing\Exception\RouteNotFoundException $e, \Illuminate\Http\Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'message' => 'Route not found.',
                    'error' => $e->getMessage()
                ], 404)->header('Content-Type', 'application/json');
            }
        });
    })->create();
