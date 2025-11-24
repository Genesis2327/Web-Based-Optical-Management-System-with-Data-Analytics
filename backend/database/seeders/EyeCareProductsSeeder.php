<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\User;

class EyeCareProductsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get or create "Eye Care Products" category
        $eyeCareCategory = ProductCategory::firstOrCreate(
            ['slug' => 'eye-care-products'],
            [
                'name' => 'Eye Care Products',
                'description' => 'Eye care solutions, cleaning products, and accessories',
                'sort_order' => 3,
                'is_active' => true,
            ]
        );

        // Get admin user (or first user if no admin exists)
        $adminUser = User::where('role', 'admin')->first() ?? User::first();
        if (!$adminUser) {
            $this->command->error('No users found. Please create a user first.');
            return;
        }

        // Eye care products data
        $products = [
            [
                'name' => 'Contact Lens Multi-Purpose Solution',
                'description' => 'All-in-one contact lens solution for cleaning, disinfecting, rinsing, and storing. 355ml bottle. Suitable for soft contact lenses.',
                'price' => 299.99,
                'category_id' => $eyeCareCategory->id,
                'stock_quantity' => 50,
                'is_active' => true,
                'approval_status' => 'approved',
                'brand' => 'Bausch & Lomb',
                'sku' => 'BL-CLS-001',
            ],
            [
                'name' => 'Saline Solution for Contact Lenses',
                'description' => 'Gentle saline solution for rinsing and storing contact lenses. Preservative-free formula. 120ml bottle.',
                'price' => 180.00,
                'category_id' => $eyeCareCategory->id,
                'stock_quantity' => 60,
                'is_active' => true,
                'approval_status' => 'approved',
                'brand' => 'Alcon',
                'sku' => 'AL-SAL-001',
            ],
            [
                'name' => 'Enzymatic Cleaner for Contact Lenses',
                'description' => 'Weekly protein remover tablets for deep cleaning contact lenses. Box of 12 tablets. Removes protein buildup.',
                'price' => 450.00,
                'category_id' => $eyeCareCategory->id,
                'stock_quantity' => 40,
                'is_active' => true,
                'approval_status' => 'approved',
                'brand' => 'Bausch & Lomb',
                'sku' => 'BL-ENZ-001',
            ],
            [
                'name' => 'Lens Cleaning Spray',
                'description' => 'Professional grade anti-fog lens cleaning spray for eyeglasses. 120ml bottle. Safe for all lens coatings including anti-reflective.',
                'price' => 280.00,
                'category_id' => $eyeCareCategory->id,
                'stock_quantity' => 70,
                'is_active' => true,
                'approval_status' => 'approved',
                'brand' => 'Zeiss',
                'sku' => 'ZS-SPR-001',
            ],
            [
                'name' => 'Premium Microfiber Cleaning Cloth',
                'description' => 'Ultra-soft microfiber cleaning cloth for glasses. Pack of 3 cloths. Scratch-resistant and washable. Perfect for cleaning lenses without leaving streaks.',
                'price' => 250.00,
                'category_id' => $eyeCareCategory->id,
                'stock_quantity' => 80,
                'is_active' => true,
                'approval_status' => 'approved',
                'brand' => 'OptiClean',
                'sku' => 'OC-MIC-001',
            ],
            [
                'name' => 'Lens Cleaning Wipes',
                'description' => 'Pre-moistened lens cleaning wipes. Pack of 50 individually wrapped wipes. Convenient for on-the-go cleaning. Safe for all lens types.',
                'price' => 320.00,
                'category_id' => $eyeCareCategory->id,
                'stock_quantity' => 55,
                'is_active' => true,
                'approval_status' => 'approved',
                'brand' => 'Zeiss',
                'sku' => 'ZS-WIP-001',
            ],
            [
                'name' => 'Contact Lens Case',
                'description' => 'Durable contact lens storage case with separate compartments for left and right lenses. Includes date indicators. Replace every 3 months.',
                'price' => 150.00,
                'category_id' => $eyeCareCategory->id,
                'stock_quantity' => 100,
                'is_active' => true,
                'approval_status' => 'approved',
                'brand' => 'Alcon',
                'sku' => 'AL-CASE-001',
            ],
            [
                'name' => 'Eye Drops - Lubricating',
                'description' => 'Preservative-free lubricating eye drops for dry eyes. 10ml bottle. Provides instant relief and comfort for dry, irritated eyes.',
                'price' => 380.00,
                'category_id' => $eyeCareCategory->id,
                'stock_quantity' => 45,
                'is_active' => true,
                'approval_status' => 'approved',
                'brand' => 'Systane',
                'sku' => 'SY-EYE-001',
            ],
            [
                'name' => 'Eye Drops - Redness Relief',
                'description' => 'Eye drops to relieve redness and irritation. 15ml bottle. Fast-acting formula that soothes tired, red eyes.',
                'price' => 320.00,
                'category_id' => $eyeCareCategory->id,
                'stock_quantity' => 50,
                'is_active' => true,
                'approval_status' => 'approved',
                'brand' => 'Rohto',
                'sku' => 'RH-EYE-001',
            ],
            [
                'name' => 'Eyeglass Repair Kit',
                'description' => 'Complete eyeglass repair kit with screws, nose pads, screwdriver, and cleaning cloth. Essential for maintaining your glasses.',
                'price' => 450.00,
                'category_id' => $eyeCareCategory->id,
                'stock_quantity' => 35,
                'is_active' => true,
                'approval_status' => 'approved',
                'brand' => 'Universal',
                'sku' => 'UN-REP-001',
            ],
            [
                'name' => 'Anti-Fog Spray for Masks',
                'description' => 'Anti-fog spray to prevent glasses from fogging when wearing masks. 60ml bottle. Long-lasting effect, safe for all lens coatings.',
                'price' => 280.00,
                'category_id' => $eyeCareCategory->id,
                'stock_quantity' => 65,
                'is_active' => true,
                'approval_status' => 'approved',
                'brand' => 'OptiClear',
                'sku' => 'OC-FOG-001',
            ],
            [
                'name' => 'Lens Cleaning Towelettes',
                'description' => 'Wet lens cleaning towelettes for eyeglasses. Pack of 30 individually wrapped towelettes. Convenient travel size. Removes dirt, oil, and smudges.',
                'price' => 290.00,
                'category_id' => $eyeCareCategory->id,
                'stock_quantity' => 60,
                'is_active' => true,
                'approval_status' => 'approved',
                'brand' => 'Zeiss',
                'sku' => 'ZS-TOW-001',
            ],
        ];

        // Create products
        $created = 0;
        foreach ($products as $productData) {
            // Check if product already exists by SKU
            $existing = Product::where('sku', $productData['sku'])->first();
            if ($existing) {
                $this->command->warn("Product with SKU {$productData['sku']} already exists. Skipping...");
                continue;
            }

            $productData['created_by'] = $adminUser->id;
            $productData['created_by_role'] = $adminUser->role->value ?? 'admin';
            $productData['image_paths'] = [];
            $productData['min_stock_threshold'] = 10;

            Product::create($productData);
            $created++;
        }

        $this->command->info("Successfully seeded {$created} eye care products in '{$eyeCareCategory->name}' category!");
        
        if ($created < count($products)) {
            $this->command->warn((count($products) - $created) . " products were skipped because they already exist.");
        }
    }
}

