<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Console\Command;

class UpdateFrameCategories extends Command
{
    protected $signature = 'products:update-frame-categories {--dry-run : Show what would be updated without making changes}';
    protected $description = 'Update frame products to use Frames category instead of Eyeglasses';

    public function handle()
    {
        $dryRun = $this->option('dry-run');
        
        // Get categories
        $framesCategory = ProductCategory::where('name', 'Frames')
            ->orWhere('slug', 'frames')
            ->first();
        
        $eyeglassesCategory = ProductCategory::where('name', 'Eyeglasses')
            ->orWhere('slug', 'eyeglasses')
            ->first();
        
        if (!$framesCategory) {
            $this->error('Frames category not found!');
            return 1;
        }
        
        if (!$eyeglassesCategory) {
            $this->info('Eyeglasses category not found. No products to update.');
            return 0;
        }
        
        $this->info("Frames Category ID: {$framesCategory->id}");
        $this->info("Eyeglasses Category ID: {$eyeglassesCategory->id}");
        $this->newLine();
        
        // Find products in Eyeglasses category that should be in Frames
        $products = Product::where('category_id', $eyeglassesCategory->id)->get();
        
        if ($products->isEmpty()) {
            $this->info('No products found in Eyeglasses category.');
            return 0;
        }
        
        $this->info("Found {$products->count()} products in Eyeglasses category:");
        foreach ($products as $product) {
            $this->line("  - ID {$product->id}: {$product->name}");
        }
        $this->newLine();
        
        if ($dryRun) {
            $this->warn('DRY RUN: Would update these products to Frames category');
            return 0;
        }
        
        // Update products
        $updated = Product::where('category_id', $eyeglassesCategory->id)
            ->update(['category_id' => $framesCategory->id]);
        
        $this->info("✅ Updated {$updated} products to Frames category!");
        
        return 0;
    }
}

