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
                'name' => 'Solution',
                'slug' => 'solution',
                'description' => 'Eye care solutions and cleaning products',
                'sort_order' => 1,
                'is_active' => true,
            ],
            [
                'name' => 'Contact Lens',
                'slug' => 'contact-lens',
                'description' => 'Various types of contact lenses',
                'sort_order' => 2,
                'is_active' => true,
            ],
            [
                'name' => 'Frames',
                'slug' => 'frames',
                'description' => 'Eyeglass frames and prescription frames',
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
            ProductCategory::updateOrCreate(
                ['slug' => $category['slug']],
                $category
            );
        }

        $this->command->info('Product categories seeded successfully!');
    }
}



