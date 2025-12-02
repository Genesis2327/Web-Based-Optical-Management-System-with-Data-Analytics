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
                'name' => 'Modern Aviator Style - LuxeVision AV-250',
                'description' => 'Contemporary aviator frame with polished metal construction. Ideal for professional and casual wear with adjustable nose pads.',
                'price' => 2500.00,
                'category_id' => $categoryIds['eyeglasses'],
                'stock_quantity' => 25,
                'is_active' => true,
                'approval_status' => 'approved',
                // New eyeglasses fields
                'brand' => 'LuxeVision',
                'model' => 'AV-250',
                'sku' => 'LVAV2501',
                'color' => 'Silver',
                'shape' => 'Aviator',
                'lens_width' => 58.00,
                'bridge_width' => 14.00,
                'temple_length' => 145.00,
                'frame_material' => 'Metal',
                'lens_material' => 'Mineral Glass',
                'lens_type' => 'single_vision',
                'polarized' => false,
                'uv_protection' => true,
                'gender' => 'unisex',
            ],
            [
                'name' => 'Oval Modern Style - ClarityFrames OV-350',
                'description' => 'Elegant oval frame constructed from premium titanium. Designed for comfort with flexible hinges and lightweight design.',
                'price' => 3200.00,
                'category_id' => $categoryIds['eyeglasses'],
                'stock_quantity' => 18,
                'is_active' => true,
                'approval_status' => 'approved',
                // New eyeglasses fields
                'brand' => 'ClarityFrames',
                'model' => 'OV-350',
                'sku' => 'CFOV3501',
                'color' => 'Titanium',
                'shape' => 'Oval',
                'lens_width' => 52.00,
                'bridge_width' => 17.00,
                'temple_length' => 140.00,
                'frame_material' => 'Titanium',
                'lens_material' => 'Trivex',
                'lens_type' => 'single_vision',
                'polarized' => false,
                'uv_protection' => true,
                'gender' => 'unisex',
            ],
            [
                'name' => 'Butterfly Designer Frames - PrestigeOptics BF-450',
                'description' => 'Exclusive butterfly-shaped frames crafted from Italian acetate. A bold statement piece with intricate detailing.',
                'price' => 2800.00,
                'category_id' => $categoryIds['eyeglasses'],
                'stock_quantity' => 22,
                'is_active' => true,
                'approval_status' => 'approved',
                // New eyeglasses fields
                'brand' => 'PrestigeOptics',
                'model' => 'BF-450',
                'sku' => 'POBF4501',
                'color' => 'Crystal',
                'shape' => 'Butterfly',
                'lens_width' => 54.00,
                'bridge_width' => 19.00,
                'temple_length' => 138.00,
                'frame_material' => 'Acetate',
                'lens_material' => 'Polycarbonate',
                'lens_type' => 'single_vision',
                'polarized' => false,
                'uv_protection' => true,
                'gender' => 'women',
            ],
            [
                'name' => 'Hexagonal Bold Frames - ModernEdge HX-500',
                'description' => 'Unique hexagonal design with striking geometry. Made from reinforced composite material for durability and style.',
                'price' => 3500.00,
                'category_id' => $categoryIds['eyeglasses'],
                'stock_quantity' => 30,
                'is_active' => true,
                'approval_status' => 'approved',
                // New eyeglasses fields
                'brand' => 'ModernEdge',
                'model' => 'HX-500',
                'sku' => 'MEHX5001',
                'color' => 'Matte Black',
                'shape' => 'Hexagonal',
                'lens_width' => 56.00,
                'bridge_width' => 16.00,
                'temple_length' => 142.00,
                'frame_material' => 'Composite',
                'lens_material' => 'Polycarbonate',
                'lens_type' => 'single_vision',
                'polarized' => false,
                'uv_protection' => true,
                'gender' => 'unisex',
            ],

            // Sunglasses
            [
                'name' => 'Active Lifestyle Polarized Shades',
                'description' => 'Advanced polarized lenses with superior light filtration. Engineered for mountain biking, hiking, and water sports.',
                'price' => 4200.00,
                'category_id' => $categoryIds['sunglasses'],
                'stock_quantity' => 20,
                'is_active' => true,
                'approval_status' => 'approved',
                'sku' => 'SG-ACTIVE-001',
            ],
            [
                'name' => 'Retro Square Sunglasses',
                'description' => 'Vintage-inspired square frames with modern lens technology. Available in classic tortoiseshell patterns.',
                'price' => 3800.00,
                'category_id' => $categoryIds['sunglasses'],
                'stock_quantity' => 28,
                'is_active' => true,
                'approval_status' => 'approved',
                'sku' => 'SG-RETRO-001',
            ],
            [
                'name' => 'XL Jumbo Shades',
                'description' => 'Extra-large frames for maximum facial protection. Features anti-reflective coating and reinforced hinges.',
                'price' => 3200.00,
                'category_id' => $categoryIds['sunglasses'],
                'stock_quantity' => 15,
                'is_active' => true,
                'approval_status' => 'approved',
                'sku' => 'SG-JUMBO-001',
            ],

            // Contact Lenses
            [
                'name' => 'Comfort Daily Contact Lenses',
                'description' => 'Fresh daily lenses with advanced moisture technology. Pack of 30 for optimal eye comfort throughout the day.',
                'price' => 1500.00,
                'category_id' => $categoryIds['contact-lenses'],
                'stock_quantity' => 50,
                'is_active' => true,
                'approval_status' => 'approved',
                'sku' => 'CL-COMFORT-001',
            ],
            [
                'name' => 'Extended Wear Contact Lenses',
                'description' => 'Bi-weekly replacement lenses designed for comfort over extended periods. Enhanced breathability for healthy eyes.',
                'price' => 2200.00,
                'category_id' => $categoryIds['contact-lenses'],
                'stock_quantity' => 40,
                'is_active' => true,
                'approval_status' => 'approved',
                'sku' => 'CL-EXTENDED-001',
            ],
            [
                'name' => 'Enhancing Cosmetic Lenses',
                'description' => 'Subtle color enhancement lenses available in multiple shades. Creates a natural, vibrant eye appearance.',
                'price' => 2800.00,
                'category_id' => $categoryIds['contact-lenses'],
                'stock_quantity' => 35,
                'is_active' => true,
                'approval_status' => 'approved',
                'sku' => 'CL-ENHANCING-001',
            ],

            // Accessories
            [
                'name' => 'Protective Eyewear Case',
                'description' => 'Rugged exterior case designed to shield eyeglasses from impact and scratches. Interior plush lining prevents damage.',
                'price' => 350.00,
                'category_id' => $categoryIds['accessories'],
                'stock_quantity' => 100,
                'is_active' => true,
                'approval_status' => 'approved',
                'sku' => 'AC-PROTECTIVE-001',
            ],
            [
                'name' => 'Professional Lens Cleaner',
                'description' => 'Anti-static cleaning spray formulated for delicate optical surfaces. 150ml bottle ensures streak-free clarity.',
                'price' => 280.00,
                'category_id' => $categoryIds['accessories'],
                'stock_quantity' => 150,
                'is_active' => true,
                'approval_status' => 'approved',
                'sku' => 'AC-CLEANER-001',
            ],
            [
                'name' => 'Premium Cloth Bundle',
                'description' => 'Collection of 5 specialized microfiber cloths with different fabric weaves. Suitable for various lens types and coatings.',
                'price' => 200.00,
                'category_id' => $categoryIds['accessories'],
                'stock_quantity' => 200,
                'is_active' => true,
                'approval_status' => 'approved',
                'sku' => 'AC-BUNDLE-001',
            ],
            [
                'name' => 'Sports Retention Band',
                'description' => 'Elastic headband engineered to hold eyewear firmly during high-intensity activities. Sweat-resistant and adjustable design.',
                'price' => 180.00,
                'category_id' => $categoryIds['accessories'],
                'stock_quantity' => 80,
                'is_active' => true,
                'approval_status' => 'approved',
                'sku' => 'AC-BAND-001',
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
