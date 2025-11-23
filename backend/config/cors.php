<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Laravel CORS Configuration
    |--------------------------------------------------------------------------
    |
    | You can set the CORS configuration for your application here. This
    | configuration will be used to handle CORS requests.
    |
    */

    'paths' => ['api/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5176',
        'http://localhost:8080',
        'http://localhost:8081',
        'http://localhost:8082',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
        'http://127.0.0.1:5176',
        'http://127.0.0.1:8080',
        'http://127.0.0.1:8081',
        'http://127.0.0.1:8082',
        'http://192.168.56.1:3000',
        'http://192.168.56.1:5173',
        'http://192.168.56.1:5174',
        'http://192.168.56.1:5176',
        'http://192.168.56.1:8080',
        'http://192.168.56.1:8081',
        'http://192.168.56.1:8082',
        'http://192.168.100.6:3000',
        'http://192.168.100.6:5173',
        'http://192.168.100.6:5174',
        'http://192.168.100.6:5175',
        'http://192.168.100.6:5176',
        'http://192.168.100.6:8080',
        'http://192.168.100.6:8081',
        'http://192.168.100.6:8082',
        'http://10.173.7.92:3000',
        'http://10.173.7.92:5173',
        'http://10.173.7.92:5174',
        'http://10.173.7.92:5176',
        'http://10.173.7.92:8080',
        'http://10.173.7.92:8081',
        'http://10.173.7.92:8082',
        'http://10.35.44.92:3000',
        'http://10.35.44.92:5173',
        'http://10.35.44.92:5174',
        'http://10.35.44.92:5176',
        'http://10.35.44.92:8080',
        'http://10.35.44.92:8081',
        'http://10.35.44.92:8082',
        // Allow file:// protocol for local testing
        'null',
        // Production URLs - will be updated after deployment
        'https://everbright-optical-frontend.vercel.app',
        'https://everbright-optical-frontend.vercel.app/',
        // Netlify URLs
        'https://everbright-optical-system.netlify.app',
        'https://everbright-optical-system.netlify.app/',
        // Allow any Netlify subdomain
        'https://*.netlify.app',
        // Vercel URLs
        'https://everbright-optical-system.vercel.app',
        'https://everbright-optical-system.vercel.app/',
        // Allow any Vercel subdomain
        'https://*.vercel.app',
        // GitHub Pages URLs
        'https://protacium05.github.io',
        'https://protacium05.github.io/',
        // Allow any GitHub Pages subdomain
        'https://*.github.io',
        // Railway frontend domains
        'https://everbright-optical-clinic-system-production-2f77.up.railway.app',
        'https://everbright-optical-clinic-system-production.up.railway.app',
        // Allow any Railway subdomain
        'https://*.up.railway.app',
    ],

    'allowed_origins_patterns' => [
        // Allow localhost and LAN IPs with any port during development
        '^http:\/\/localhost(?:\:[0-9]+)?$',
        '^http:\/\/127\.0\.0\.1(?:\:[0-9]+)?$',
        '^http:\/\/192\.168\.[0-9]+\.[0-9]+(?:\:[0-9]+)?$',
        '^http:\/\/10\.[0-9]+\.[0-9]+\.[0-9]+(?:\:[0-9]+)?$',
        // Allow file:// protocol for local testing
        '^file:\/\/',
        // Allow Netlify domains
        '^https:\/\/.*\.netlify\.app$',
        // Allow Vercel domains
        '^https:\/\/.*\.vercel\.app$',
        // Allow GitHub Pages domains
        '^https:\/\/.*\.github\.io$',
        // Allow Railway domains
        '^https:\/\/.*\.up\.railway\.app$',
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];