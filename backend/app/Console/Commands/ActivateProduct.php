<?php

namespace App\Console\Commands;

use App\Models\Product;
use Illuminate\Console\Command;

class ActivateProduct extends Command
{
    protected $signature = 'product:activate {name}';
    protected $description = 'Activate a deactivated product by name';

    public function handle()
    {
        $name = $this->argument('name');
        
        $this->info("Searching for product: {$name}");
        
        $product = Product::withTrashed()
            ->where('name', $name)
            ->first();
        
        if (!$product) {
            $this->error("Product not found: {$name}");
            return 1;
        }
        
        if ($product->trashed()) {
            $this->warn("Product is deleted. Restoring first...");
            $product->restore();
        }
        
        if ($product->is_active) {
            $this->warn("Product '{$name}' (ID: {$product->id}) is already active.");
            return 0;
        }
        
        $this->info("Activating product: {$name} (ID: {$product->id})");
        
        $product->update(['is_active' => true]);
        
        $this->info("✓ Product '{$name}' has been activated successfully!");
        $this->info("  Product ID: {$product->id}");
        $this->info("  Price: ₱" . number_format($product->price, 2));
        $this->info("  Status: Active");
        
        return 0;
    }
}

