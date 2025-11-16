<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\ProductCategory;
use App\Models\Product;

class FixDuplicateEyeCareCategory extends Command
{
    protected $signature = 'categories:fix-duplicate';
    protected $description = 'Fix duplicate Eye Care category by migrating products and removing duplicate';

    public function handle()
    {
        $this->info('🔧 Fixing duplicate Eye Care category...');
        $this->newLine();

        // Find the old "Eye Care" category
        $oldEyeCare = ProductCategory::where('slug', 'eye-care')->first();
        $newEyeCare = ProductCategory::where('slug', 'eye-care-products')->first();

        if (!$newEyeCare) {
            $this->error('Eye Care Products category not found!');
            return 1;
        }

        if ($oldEyeCare) {
            // Migrate products from old category to new one
            $productsCount = Product::where('category_id', $oldEyeCare->id)->count();
            
            if ($productsCount > 0) {
                $this->info("  Migrating {$productsCount} products from 'Eye Care' to 'Eye Care Products'...");
                Product::where('category_id', $oldEyeCare->id)->update([
                    'category_id' => $newEyeCare->id
                ]);
                $this->line("  ✅ Migrated {$productsCount} products");
            }

            // Delete the old category
            $oldEyeCare->delete();
            $this->line("  ✅ Deleted duplicate 'Eye Care' category");
        } else {
            $this->line("  ℹ️  'Eye Care' category already removed");
        }

        // Verify only active categories remain
        $categories = ProductCategory::where('is_active', true)->orderBy('sort_order')->get(['id', 'name', 'slug']);
        
        $this->newLine();
        $this->info('✅ Active categories:');
        foreach ($categories as $cat) {
            $this->line("  • {$cat->name}");
        }

        return 0;
    }
}



