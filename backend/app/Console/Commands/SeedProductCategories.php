<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\ProductCategory;

class SeedProductCategories extends Command
{
    protected $signature = 'categories:seed';
    protected $description = 'Seed product categories: Frames, Contact Lenses, Eye Care Products, Sunglasses';

    public function handle()
    {
        $this->info('🌱 Seeding Product Categories...');
        $this->newLine();

        $categories = [
            [
                'name' => 'Frames',
                'slug' => 'frames',
                'description' => 'Eyeglass frames and prescription frames',
                'sort_order' => 1,
                'is_active' => true,
            ],
            [
                'name' => 'Contact Lenses',
                'slug' => 'contact-lenses',
                'description' => 'Various types of contact lenses',
                'sort_order' => 2,
                'is_active' => true,
            ],
            [
                'name' => 'Eye Care Products',
                'slug' => 'eye-care-products',
                'description' => 'Eye care solutions, cleaning products, and accessories',
                'sort_order' => 3,
                'is_active' => true,
            ],
            [
                'name' => 'Sunglasses',
                'slug' => 'sunglasses',
                'description' => 'UV protection sunglasses and protective eyewear',
                'sort_order' => 4,
                'is_active' => true,
            ],
        ];

        $created = 0;
        $updated = 0;
        $deleted = 0;

        // First, deactivate or delete categories that are not in our list
        $validSlugs = array_column($categories, 'slug');
        $oldCategories = ProductCategory::whereNotIn('slug', $validSlugs)->get();
        
        foreach ($oldCategories as $oldCat) {
            // Check if category has products (using category_id column)
            try {
                $productCount = \App\Models\Product::where('category_id', $oldCat->id)->count();
                if ($productCount > 0) {
                    // If it has products, just deactivate it
                    $oldCat->update(['is_active' => false]);
                    $this->line("  ⚠️  Deactivated (has products): {$oldCat->name}");
                } else {
                    // If no products, delete it
                    $oldCat->delete();
                    $deleted++;
                    $this->line("  🗑️  Deleted: {$oldCat->name}");
                }
            } catch (\Exception $e) {
                // If checking fails, just deactivate to be safe
                $oldCat->update(['is_active' => false]);
                $this->line("  ⚠️  Deactivated (error checking products): {$oldCat->name}");
            }
        }

        foreach ($categories as $category) {
            $existing = ProductCategory::where('slug', $category['slug'])->first();
            
            if ($existing) {
                // Update existing category to ensure all fields match
                $existing->update([
                    'name' => $category['name'],
                    'description' => $category['description'],
                    'sort_order' => $category['sort_order'],
                    'is_active' => $category['is_active'],
                ]);
                if ($existing->wasChanged()) {
                    $updated++;
                    $this->line("  ✅ Updated: {$category['name']}");
                } else {
                    $this->line("  ⏭️  Already exists: {$category['name']}");
                }
            } else {
                ProductCategory::create($category);
                $created++;
                $this->line("  ✅ Created: {$category['name']}");
            }
        }

        $this->newLine();
        $this->info("✅ Product categories seeded successfully!");
        $this->info("   Created: {$created}");
        $this->info("   Updated: {$updated}");
        if ($deleted > 0) {
            $this->info("   Deleted: {$deleted}");
        }
        
        return 0;
    }
}

