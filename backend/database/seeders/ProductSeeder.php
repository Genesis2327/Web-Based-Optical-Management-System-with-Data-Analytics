<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\User;

class ProductSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get or create categories
        $categories = [
            ['name' => 'Eyeglasses', 'slug' => 'eyeglasses', 'description' => 'Prescription and fashion eyeglasses', 'icon' => '👓', 'color' => 'blue'],
            ['name' => 'Sunglasses', 'slug' => 'sunglasses', 'description' => 'UV protection sunglasses', 'icon' => '🕶️', 'color' => 'orange'],
            ['name' => 'Contact Lenses', 'slug' => 'contact-lenses', 'description' => 'Various types of contact lenses', 'icon' => '👁️', 'color' => 'green'],
            ['name' => 'Accessories', 'slug' => 'accessories', 'description' => 'Cases, cleaning solutions, and more', 'icon' => '🧴', 'color' => 'purple'],
        ];

        $categoryIds = [];
        foreach ($categories as $category) {
            $cat = ProductCategory::firstOrCreate(
                ['slug' => $category['slug']],
                [
                    'name' => $category['name'],
                    'description' => $category['description'],
                    'icon' => $category['icon'],
                    'color' => $category['color'],
                    'is_active' => true,
                ]
            );
            $categoryIds[$category['slug']] = $cat->id;
        }

        // Get admin user (or first user if no admin exists)
        $adminUser = User::where('role', 'admin')->first() ?? User::first();
        if (!$adminUser) {
            $this->command->error('No users found. Please create a user first.');
            return;
        }

        // Sample products data
        $products = [
            // Eyeglasses
            [
                'name' => 'Classic Rectangle Frame - OptiClear RC-100',
                'description' => 'Timeless rectangular frame suitable for most face shapes. Features lightweight acetate material and spring hinges for comfort.',
                'price' => 2500.00,
                'category_id' => $categoryIds['eyeglasses'],
                'stock_quantity' => 25,
                'is_active' => true,
                'approval_status' => 'approved',
                // New eyeglasses fields
                'brand' => 'OptiClear',
                'model' => 'RC-100',
                'sku' => 'OCRC1001',
                'color' => 'Black',
                'shape' => 'Rectangle',
                'lens_width' => 52.00,
                'bridge_width' => 16.00,
                'temple_length' => 140.00,
                'frame_material' => 'Acetate',
                'lens_material' => 'Polycarbonate',
                'lens_type' => 'single_vision',
                'polarized' => false,
                'uv_protection' => true,
                'gender' => 'unisex',
            ],
            [
                'name' => 'Round Vintage Glasses - VisionPro RV-200',
                'description' => 'Retro-inspired round frame with thin metal construction. Perfect for creating a sophisticated, intellectual look.',
                'price' => 3200.00,
                'category_id' => $categoryIds['eyeglasses'],
                'stock_quantity' => 18,
                'is_active' => true,
                'approval_status' => 'approved',
                // New eyeglasses fields
                'brand' => 'VisionPro',
                'model' => 'RV-200',
                'sku' => 'VPRV2001',
                'color' => 'Gold',
                'shape' => 'Round',
                'lens_width' => 48.00,
                'bridge_width' => 20.00,
                'temple_length' => 145.00,
                'frame_material' => 'Metal',
                'lens_material' => 'Glass',
                'lens_type' => 'single_vision',
                'polarized' => false,
                'uv_protection' => true,
                'gender' => 'unisex',
            ],
            [
                'name' => 'Cat Eye Fashion Frame - ElegantView CE-300',
                'description' => 'Stylish cat-eye design for women. Made with premium acetate and available in multiple colors.',
                'price' => 2800.00,
                'category_id' => $categoryIds['eyeglasses'],
                'stock_quantity' => 22,
                'is_active' => true,
                'approval_status' => 'approved',
                // New eyeglasses fields
                'brand' => 'ElegantView',
                'model' => 'CE-300',
                'sku' => 'EVCE3001',
                'color' => 'Tortoise',
                'shape' => 'Cat Eye',
                'lens_width' => 50.00,
                'bridge_width' => 18.00,
                'temple_length' => 135.00,
                'frame_material' => 'Acetate',
                'lens_material' => 'Polycarbonate',
                'lens_type' => 'single_vision',
                'polarized' => false,
                'uv_protection' => true,
                'gender' => 'women',
            ],
            [
                'name' => 'Aviator Metal Frame',
                'description' => 'Classic aviator style in durable metal. Adjustable nose pads for a customized fit.',
                'price' => 3500.00,
                'category_id' => $categoryIds['eyeglasses'],
                'stock_quantity' => 30,
                'is_active' => true,
                'approval_status' => 'approved',
                // New eyeglasses fields
                'brand' => 'Aviator',
                'model' => 'AM-400',
                'sku' => 'AVAM4001',
                'color' => 'Silver',
                'shape' => 'Aviator',
                'lens_width' => 55.00,
                'bridge_width' => 14.00,
                'temple_length' => 150.00,
                'frame_material' => 'Metal',
                'lens_material' => 'Mineral Glass',
                'lens_type' => 'single_vision',
                'polarized' => false,
                'uv_protection' => true,
                'gender' => 'unisex',
            ],

            // Sunglasses
            [
                'name' => 'Polarized Sports Sunglasses',
                'description' => 'High-performance polarized lenses with 100% UV protection. Perfect for outdoor activities and driving.',
                'price' => 4200.00,
                'category_id' => $categoryIds['sunglasses'],
                'stock_quantity' => 20,
                'is_active' => true,
                'approval_status' => 'approved',
            ],
            [
                'name' => 'Classic Wayfarer Sunglasses',
                'description' => 'Iconic wayfarer design with gradient lenses. Timeless style meets modern UV protection.',
                'price' => 3800.00,
                'category_id' => $categoryIds['sunglasses'],
                'stock_quantity' => 28,
                'is_active' => true,
                'approval_status' => 'approved',
            ],
            [
                'name' => 'Oversized Fashion Sunglasses',
                'description' => 'Large frame sunglasses for maximum face coverage and style. Features gradient tinted lenses.',
                'price' => 3200.00,
                'category_id' => $categoryIds['sunglasses'],
                'stock_quantity' => 15,
                'is_active' => true,
                'approval_status' => 'approved',
            ],

            // Contact Lenses
            [
                'name' => 'Daily Disposable Contact Lenses',
                'description' => 'Single-use daily contact lenses. Box of 30 lenses. Provides all-day comfort and convenience.',
                'price' => 1500.00,
                'category_id' => $categoryIds['contact-lenses'],
                'stock_quantity' => 50,
                'is_active' => true,
                'approval_status' => 'approved',
            ],
            [
                'name' => 'Monthly Contact Lenses',
                'description' => '30-day extended wear contact lenses. Pack of 6 lenses. High oxygen permeability for eye health.',
                'price' => 2200.00,
                'category_id' => $categoryIds['contact-lenses'],
                'stock_quantity' => 40,
                'is_active' => true,
                'approval_status' => 'approved',
            ],
            [
                'name' => 'Colored Contact Lenses',
                'description' => 'Monthly colored contact lenses available in various colors. Natural-looking enhancement for your eye color.',
                'price' => 2800.00,
                'category_id' => $categoryIds['contact-lenses'],
                'stock_quantity' => 35,
                'is_active' => true,
                'approval_status' => 'approved',
            ],

            // Accessories
            [
                'name' => 'Hard Shell Glasses Case',
                'description' => 'Durable hard shell case to protect your glasses. Available in multiple colors with soft interior lining.',
                'price' => 350.00,
                'category_id' => $categoryIds['accessories'],
                'stock_quantity' => 100,
                'is_active' => true,
                'approval_status' => 'approved',
            ],
            [
                'name' => 'Lens Cleaning Solution',
                'description' => 'Professional grade lens cleaning spray. 120ml bottle, safe for all lens coatings.',
                'price' => 280.00,
                'category_id' => $categoryIds['accessories'],
                'stock_quantity' => 150,
                'is_active' => true,
                'approval_status' => 'approved',
            ],
            [
                'name' => 'Microfiber Cleaning Cloth Set',
                'description' => 'Pack of 5 premium microfiber cleaning cloths. Perfect for cleaning glasses without scratching.',
                'price' => 200.00,
                'category_id' => $categoryIds['accessories'],
                'stock_quantity' => 200,
                'is_active' => true,
                'approval_status' => 'approved',
            ],
            [
                'name' => 'Anti-Slip Eyeglass Strap',
                'description' => 'Adjustable eyeglass strap to keep your glasses secure during activities. Comfortable neoprene material.',
                'price' => 180.00,
                'category_id' => $categoryIds['accessories'],
                'stock_quantity' => 80,
                'is_active' => true,
                'approval_status' => 'approved',
            ],
        ];

        // Create products
        foreach ($products as $productData) {
            $productData['created_by'] = $adminUser->id;
            $productData['created_by_role'] = $adminUser->role->value;

            // Note: In a real scenario, you would also upload actual images
            // For now, we'll create products without images
            $productData['image_paths'] = [];

            Product::create($productData);
        }

        $this->command->info('Successfully seeded ' . count($products) . ' products!');
    }
}
