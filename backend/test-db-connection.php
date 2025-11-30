<?php

/**
 * Simple database connection test script
 * Run: php test-db-connection.php
 */

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

try {
    $pdo = DB::connection()->getPdo();
    echo "✅ Database connection successful!\n";
    echo "   Database: " . DB::connection()->getDatabaseName() . "\n";
    echo "   Driver: " . DB::connection()->getDriverName() . "\n\n";
    
    // Test some table counts
    echo "📊 Database Statistics:\n";
    echo "   Users: " . DB::table('users')->count() . "\n";
    echo "   Products: " . DB::table('products')->count() . "\n";
    echo "   Appointments: " . DB::table('appointments')->count() . "\n";
    echo "   Branches: " . DB::table('branches')->count() . "\n";
    
    // Check if products have SKU
    $productsWithSku = DB::table('products')->whereNotNull('sku')->count();
    $totalProducts = DB::table('products')->count();
    echo "\n📦 Products with SKU: {$productsWithSku} / {$totalProducts}\n";
    
    if ($productsWithSku < $totalProducts) {
        echo "   ⚠️  Some products are missing SKU values\n";
    } else {
        echo "   ✅ All products have SKU values\n";
    }
    
} catch (\Exception $e) {
    echo "❌ Database connection failed!\n";
    echo "   Error: " . $e->getMessage() . "\n";
    echo "\nPlease check:\n";
    echo "   1. MySQL/MariaDB is running\n";
    echo "   2. Database 'everbright_optical' exists\n";
    echo "   3. .env file has correct credentials\n";
    exit(1);
}


