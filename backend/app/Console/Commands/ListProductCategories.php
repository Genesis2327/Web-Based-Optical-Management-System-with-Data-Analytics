<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Console\Command;

class ListProductCategories extends Command
{
    protected $signature = 'products:list-categories';
    protected $description = 'List all products and their categories';

    public function handle()
    {
        $this->info('Products and their categories:');
        $this->newLine();
        
        $products = Product::with('category')->get();
        
        $tableData = [];
        foreach ($products as $product) {
            $categoryName = $product->category ? $product->category->name : 'No Category';
            $categoryId = $product->category_id ?? 'NULL';
            
            $tableData[] = [
                'ID' => $product->id,
                'Name' => $product->name,
                'Category ID' => $categoryId,
                'Category Name' => $categoryName,
                'Is Active' => $product->is_active ? 'Yes' : 'No',
            ];
        }
        
        $this->table(
            ['ID', 'Name', 'Category ID', 'Category Name', 'Is Active'],
            $tableData
        );
        
        // Show category summary
        $this->newLine();
        $this->info('Category Summary:');
        $categories = ProductCategory::all();
        foreach ($categories as $category) {
            $count = Product::where('category_id', $category->id)->count();
            $this->line("  {$category->name} (ID: {$category->id}): {$count} products");
        }
        
        return 0;
    }
}

