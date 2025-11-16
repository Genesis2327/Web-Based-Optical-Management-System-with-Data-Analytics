<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\ProductCategory;

class ProductCategorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
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

        foreach ($categories as $category) {
            ProductCategory::firstOrCreate(
                ['slug' => $category['slug']],
                $category
            );
        }

        $this->command->info('Product categories seeded successfully!');
    }
}



