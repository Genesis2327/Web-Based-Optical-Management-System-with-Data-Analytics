<?php

namespace App\Console\Commands;

use App\Models\Product;
use Illuminate\Console\Command;

class RestoreProduct extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'product:restore {name}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Restore a deleted product by name';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $name = $this->argument('name');
        
        $this->info("Searching for product: {$name}");
        
        // Find the product including trashed ones
        $product = Product::withTrashed()
            ->where('name', $name)
            ->first();
        
        if (!$product) {
            $this->error("Product not found: {$name}");
            return 1;
        }
        
        if (!$product->trashed()) {
            $this->warn("Product '{$name}' (ID: {$product->id}) is not deleted.");
            return 0;
        }
        
        $this->info("Found deleted product: {$name} (ID: {$product->id})");
        
        // Restore the product
        $product->restore();
        
        $this->info("✓ Product '{$name}' has been restored successfully!");
        $this->info("  Product ID: {$product->id}");
        $this->info("  Price: ₱" . number_format($product->price, 2));
        
        return 0;
    }
}

