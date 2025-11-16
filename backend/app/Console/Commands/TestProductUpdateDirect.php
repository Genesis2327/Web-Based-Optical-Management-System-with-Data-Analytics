<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Product;
use Illuminate\Support\Facades\DB;

class TestProductUpdateDirect extends Command
{
    protected $signature = 'product:test-direct-update {id} {price}';
    protected $description = 'Test direct database update to verify product can be updated';

    public function handle()
    {
        $id = $this->argument('id');
        $newPrice = (float) $this->argument('price');
        
        $product = Product::find($id);
        
        if (!$product) {
            $this->error("Product {$id} not found");
            return 1;
        }
        
        $this->info("=== BEFORE UPDATE ===");
        $this->info("Product ID: {$product->id}");
        $this->info("Name: {$product->name}");
        $this->info("Current Price: {$product->price}");
        $this->info("Price Type: " . gettype($product->price));
        
        // Update directly
        $product->price = $newPrice;
        $saved = $product->save();
        
        $this->info("Save result: " . ($saved ? "TRUE" : "FALSE"));
        
        // Refresh and check
        $product->refresh();
        
        $this->info("=== AFTER UPDATE ===");
        $this->info("New Price: {$product->price}");
        $this->info("Price changed: " . (abs($product->price - $newPrice) < 0.01 ? "YES" : "NO"));
        
        // Also check database directly
        $dbPrice = DB::table('products')->where('id', $id)->value('price');
        $this->info("Database price: {$dbPrice}");
        
        if (abs($product->price - $newPrice) < 0.01) {
            $this->info("✅ Direct update works!");
        } else {
            $this->error("❌ Direct update failed!");
        }
        
        return 0;
    }
}



