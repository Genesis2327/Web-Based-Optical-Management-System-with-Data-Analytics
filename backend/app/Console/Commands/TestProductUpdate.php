<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Product;
use Illuminate\Support\Facades\Log;

class TestProductUpdate extends Command
{
    protected $signature = 'product:test-update {id} {price}';
    protected $description = 'Test updating a product price';

    public function handle()
    {
        $id = $this->argument('id');
        $newPrice = (float) $this->argument('price');
        
        $product = Product::find($id);
        
        if (!$product) {
            $this->error("Product {$id} not found");
            return 1;
        }
        
        $this->info("Current price: {$product->price}");
        $this->info("Updating to: {$newPrice}");
        
        $product->update(['price' => $newPrice]);
        $product->refresh();
        
        $this->info("New price: {$product->price}");
        
        if (abs($product->price - $newPrice) < 0.01) {
            $this->info("✅ Price updated successfully!");
        } else {
            $this->error("❌ Price update failed!");
        }
        
        return 0;
    }
}



