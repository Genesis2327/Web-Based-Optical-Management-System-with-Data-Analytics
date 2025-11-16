<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ProductCategory;
use App\Models\User;
use App\Models\Branch;

class FerrariSunglassesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get or create a category for sunglasses
        $category = ProductCategory::firstOrCreate(
            ['name' => 'Sunglasses'],
            [
                'slug' => 'sunglasses',
                'description' => 'High-quality sunglasses and eyewear',
            ]
        );

        // Get the first admin user or create one
        $admin = User::where('role', 'admin')->first();
        if (!$admin) {
            $admin = User::create([
                'name' => 'Admin User',
                'email' => 'admin@example.com',
                'password' => bcrypt('password'),
                'role' => 'admin',
                'is_approved' => true,
            ]);
        }

        // Get the first branch or create one
        $branch = Branch::first();
        if (!$branch) {
            $branch = Branch::create([
                'name' => 'Main Branch',
                'code' => 'MAIN',
                'address' => '123 Main Street',
                'phone' => '123-456-7890',
                'email' => 'main@example.com',
                'is_active' => true,
            ]);
        }

        // Create Ferrari sunglasses product
        $ferrariSunglasses = Product::create([
            'name' => 'Ferrari Premium Sunglasses',
            'description' => 'Luxury Ferrari-branded sunglasses with premium materials and UV protection. Available in multiple stunning colors.',
            'price' => 299.99,
            'category_id' => $category->id,
            'created_by' => $admin->id,
            'is_active' => true,
            'approval_status' => 'approved',
            'stock_quantity' => 0, // Will be managed per variant
            'image_paths' => [
                'products/ferrari-red-main.jpg',
                'products/ferrari-blue-main.jpg',
                'products/ferrari-black-main.jpg',
            ],
            'primary_image' => 'products/ferrari-red-main.jpg',
        ]);

        // Create color variants
        $colorVariants = [
            [
                'variant_value' => 'red',
                'variant_name' => 'Ferrari Red',
                'image_paths' => [
                    'products/ferrari-red-1.jpg',
                    'products/ferrari-red-2.jpg',
                    'products/ferrari-red-3.jpg',
                ],
                'primary_image' => 'products/ferrari-red-1.jpg',
                'price_override' => null, // Use base price
                'sku_suffix' => 'RED',
                'sort_order' => 1,
            ],
            [
                'variant_value' => 'blue',
                'variant_name' => 'Ferrari Blue',
                'image_paths' => [
                    'products/ferrari-blue-1.jpg',
                    'products/ferrari-blue-2.jpg',
                    'products/ferrari-blue-3.jpg',
                ],
                'primary_image' => 'products/ferrari-blue-1.jpg',
                'price_override' => null,
                'sku_suffix' => 'BLU',
                'sort_order' => 2,
            ],
            [
                'variant_value' => 'black',
                'variant_name' => 'Classic Black',
                'image_paths' => [
                    'products/ferrari-black-1.jpg',
                    'products/ferrari-black-2.jpg',
                    'products/ferrari-black-3.jpg',
                ],
                'primary_image' => 'products/ferrari-black-1.jpg',
                'price_override' => null,
                'sku_suffix' => 'BLK',
                'sort_order' => 3,
            ],
            [
                'variant_value' => 'white',
                'variant_name' => 'Pearl White',
                'image_paths' => [
                    'products/ferrari-white-1.jpg',
                    'products/ferrari-white-2.jpg',
                    'products/ferrari-white-3.jpg',
                ],
                'primary_image' => 'products/ferrari-white-1.jpg',
                'price_override' => 319.99, // Premium price for white
                'sku_suffix' => 'WHT',
                'sort_order' => 4,
            ],
            [
                'variant_value' => 'gold',
                'variant_name' => 'Luxury Gold',
                'image_paths' => [
                    'products/ferrari-gold-1.jpg',
                    'products/ferrari-gold-2.jpg',
                    'products/ferrari-gold-3.jpg',
                ],
                'primary_image' => 'products/ferrari-gold-1.jpg',
                'price_override' => 399.99, // Premium price for gold
                'sku_suffix' => 'GLD',
                'sort_order' => 5,
            ],
        ];

        foreach ($colorVariants as $variantData) {
            ProductVariant::create([
                'product_id' => $ferrariSunglasses->id,
                'variant_type' => 'color',
                'variant_value' => $variantData['variant_value'],
                'variant_name' => $variantData['variant_name'],
                'image_paths' => $variantData['image_paths'],
                'primary_image' => $variantData['primary_image'],
                'price_override' => $variantData['price_override'],
                'sku_suffix' => $variantData['sku_suffix'],
                'sort_order' => $variantData['sort_order'],
                'is_active' => true,
            ]);
        }

        $this->command->info('Ferrari sunglasses with color variants created successfully!');
        $this->command->info('Product ID: ' . $ferrariSunglasses->id);
        $this->command->info('Variants created: ' . count($colorVariants));
    }
}