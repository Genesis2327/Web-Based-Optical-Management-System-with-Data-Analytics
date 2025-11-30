<?php

/**
 * Add SKU values to existing products that don't have them
 * Run: php add-skus-to-products.php
 */

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "🔧 Adding SKU values to products...\n\n";

try {
    $products = DB::table('products')->whereNull('sku')->orWhere('sku', '')->get();
    
    if ($products->isEmpty()) {
        echo "✅ All products already have SKU values!\n";
        exit(0);
    }
    
    echo "Found {$products->count()} products without SKU\n\n";
    
    $updated = 0;
    $skipped = 0;
    
    foreach ($products as $product) {
        // Generate SKU based on product name and ID
        $name = $product->name ?? 'PROD';
        $categoryId = $product->category_id ?? 0;
        
        // Get category slug for prefix
        $category = DB::table('product_categories')->where('id', $categoryId)->first();
        $categoryPrefix = 'PROD';
        
        if ($category) {
            $slug = strtoupper(substr($category->slug ?? 'PROD', 0, 3));
            $categoryPrefix = $slug;
        }
        
        // Generate SKU: Category prefix + Product ID + Short name
        $shortName = preg_replace('/[^A-Z0-9]/', '', strtoupper(substr($name, 0, 6)));
        $sku = $categoryPrefix . '-' . str_pad($product->id, 4, '0', STR_PAD_LEFT) . '-' . $shortName;
        
        // Make sure SKU is unique
        $originalSku = $sku;
        $counter = 1;
        while (DB::table('products')->where('sku', $sku)->where('id', '!=', $product->id)->exists()) {
            $sku = $originalSku . '-' . $counter;
            $counter++;
        }
        
        // Update product
        DB::table('products')
            ->where('id', $product->id)
            ->update(['sku' => $sku]);
        
        $updated++;
        echo "  ✓ Product #{$product->id}: {$sku}\n";
    }
    
    echo "\n✅ Successfully added SKU to {$updated} products!\n";
    
    // Verify
    $productsWithSku = DB::table('products')->whereNotNull('sku')->where('sku', '!=', '')->count();
    $totalProducts = DB::table('products')->count();
    echo "📦 Products with SKU: {$productsWithSku} / {$totalProducts}\n";
    
} catch (\Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}


