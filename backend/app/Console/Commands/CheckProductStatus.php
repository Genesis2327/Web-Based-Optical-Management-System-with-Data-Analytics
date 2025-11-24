<?php

namespace App\Console\Commands;

use App\Models\Product;
use Illuminate\Console\Command;

class CheckProductStatus extends Command
{
    protected $signature = 'product:status {name}';
    protected $description = 'Check product status (active, deleted, etc.)';

    public function handle()
    {
        $name = $this->argument('name');
        
        $product = Product::withTrashed()
            ->where('name', $name)
            ->first();
        
        if (!$product) {
            $this->error("Product not found: {$name}");
            return 1;
        }
        
        $this->info("Product: {$name}");
        $this->info("  ID: {$product->id}");
        $this->info("  Is Active: " . ($product->is_active ? 'Yes' : 'No'));
        $this->info("  Is Deleted: " . ($product->trashed() ? 'Yes' : 'No'));
        $this->info("  Deleted At: " . ($product->deleted_at ?? 'N/A'));
        $this->info("  Price: ₱" . number_format($product->price, 2));
        $this->info("  Branch ID: " . ($product->branch_id ?? 'N/A'));
        
        if (!$product->is_active && !$product->trashed()) {
            $this->warn("\n⚠ Product is deactivated (not deleted).");
            $this->info("To activate it, update is_active to true via the API or admin panel.");
        }
        
        return 0;
    }
}

