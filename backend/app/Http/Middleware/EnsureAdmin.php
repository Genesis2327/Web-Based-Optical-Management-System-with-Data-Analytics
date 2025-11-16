<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Closure;
use Illuminate\Http\Response;

class EnsureAdmin
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle(Request $request, Closure $next)
    {
        try {
            $user = $request->user();
            
            if (!$user) {
                return response()->json([
                    'message' => 'Unauthorized. Admin access required.'
                ], 403);
            }

            // Handle role format (enum or string)
            try {
                $userRole = $user->role instanceof \App\Enums\UserRole 
                    ? $user->role->value 
                    : (string)$user->role;
            } catch (\Throwable $e) {
                \Log::warning('Error accessing user role in middleware', [
                    'user_id' => $user->id ?? null,
                    'error' => $e->getMessage()
                ]);
                $userRole = (string)$user->role;
            }
            
            if (!$userRole || $userRole !== 'admin') {
                return response()->json([
                    'message' => 'Unauthorized. Admin access required.'
                ], 403);
            }
            
            return $next($request);
        } catch (\Exception $e) {
            \Log::error('EnsureAdmin middleware error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'message' => 'Authentication error. Please try again.'
            ], 500);
        }
    }
}

