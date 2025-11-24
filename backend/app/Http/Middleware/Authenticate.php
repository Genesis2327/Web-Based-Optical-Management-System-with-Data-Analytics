<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Http\Request;
use Illuminate\Auth\AuthenticationException;

class Authenticate extends Middleware
{
    /**
     * Get the path the user should be redirected to when they are not authenticated.
     */
    protected function redirectTo(Request $request): ?string
    {
        // For API routes, return null to send JSON response
        if ($request->expectsJson() || $request->is('api/*')) {
            return null;
        }
        
        // For web routes, redirect to a login page or return null
        return null;
    }
    
    /**
     * Handle an unauthenticated user.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  array  $guards
     * @return void
     *
     * @throws \Illuminate\Auth\AuthenticationException
     */
    protected function unauthenticated($request, array $guards)
    {
        // For API routes, throw exception that will be handled by exception handler
        if ($request->is('api/*') || $request->expectsJson()) {
            throw new AuthenticationException(
                'Unauthenticated.',
                $guards,
                $this->redirectTo($request)
            );
        }
        
        // For web routes, use parent implementation
        parent::unauthenticated($request, $guards);
    }
}
