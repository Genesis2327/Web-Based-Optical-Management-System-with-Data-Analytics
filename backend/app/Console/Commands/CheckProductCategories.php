<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Console\Command;

class CheckProductCategories extends Command
{
    protected $signature = 'products:check-categories';
    protected $description = 'Check product category assignments';

    public function handle()
    {
        $this->info('Checking product categories...');
        $this->newLine();
        
        // Get Frames category
        $framesCategory = ProductCategory::where('name', 'Frames')
            ->orWhere('slug', 'frames')
            ->first();
        
        if (!$framesCategory) {
            $this->error('Frames category not found!');
            $this->info('Run: php artisan categories:seed');
            return 1;
        }
        
        $this->info("Frames Category ID: {$framesCategory->id}");
        $this->newLine();
        
        // Count products
        $totalProducts = Product::count();
        $productsWithFramesCategory = Product::where('category_id', $framesCategory->id)->count();
        $productsWithoutCategory = Product::whereNull('category_id')->count();
        $productsWithOtherCategory = Product::whereNotNull('category_id')
            ->where('category_id', '!=', $framesCategory->id)
            ->count();
        
        $this->info("Total Products: {$totalProducts}");
        $this->info("Products with Frames category: {$productsWithFramesCategory}");
        $this->info("Products without category: {$productsWithoutCategory}");
        $this->info("Products with other categories: {$productsWithOtherCategory}");
        $this->newLine();
        
        // Show sample products without category
        if ($productsWithoutCategory > 0) {
            $this->warn("Sample products without category_id:");
            $sampleProducts = Product::whereNull('category_id')
                ->limit(5)
                ->get(['id', 'name', 'category_id']);
            
            foreach ($sampleProducts as $product) {
                $this->line("  - ID {$product->id}: {$product->name}");
            }
            
            if ($productsWithoutCategory > 5) {
                $this->line("  ... and " . ($productsWithoutCategory - 5) . " more");
            }
        }
        
        return 0;
    }
}

