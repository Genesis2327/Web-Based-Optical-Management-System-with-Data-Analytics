<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\LensType;

class LensTypeSeeder extends Seeder
{
    public function run(): void
    {
        $lensTypes = [
            [
                'name' => 'Single Vision',
                'slug' => 'single-vision',
                'category' => 'single_vision',
                'description' => 'Standard single vision lenses for distance or reading',
                'base_price' => 1500.00,
                'specifications' => [
                    'index' => '1.5',
                    'coating_options' => ['anti-reflective', 'blue-light', 'scratch-resistant']
                ],
                'sort_order' => 1,
            ],
            [
                'name' => 'Bifocal',
                'slug' => 'bifocal',
                'category' => 'multifocal',
                'description' => 'Lenses with two distinct optical powers',
                'base_price' => 2500.00,
                'specifications' => [
                    'index' => '1.5',
                    'segment_height' => 'variable'
                ],
                'sort_order' => 2,
            ],
            [
                'name' => 'Progressive',
                'slug' => 'progressive',
                'category' => 'multifocal',
                'description' => 'Multifocal lenses with gradual power transition',
                'base_price' => 3500.00,
                'specifications' => [
                    'index' => '1.6',
                    'design' => 'freeform'
                ],
                'sort_order' => 3,
            ],
            [
                'name' => 'Photochromic',
                'slug' => 'photochromic',
                'category' => 'specialty',
                'description' => 'Lenses that darken in sunlight',
                'base_price' => 3000.00,
                'specifications' => [
                    'index' => '1.5',
                    'tint_type' => 'transition'
                ],
                'sort_order' => 4,
            ],
            [
                'name' => 'Polarized',
                'slug' => 'polarized',
                'category' => 'specialty',
                'description' => 'Lenses that reduce glare from reflective surfaces',
                'base_price' => 2800.00,
                'specifications' => [
                    'index' => '1.5',
                    'polarization' => true
                ],
                'sort_order' => 5,
            ],
            [
                'name' => 'Blue Light Filter',
                'slug' => 'blue-light-filter',
                'category' => 'specialty',
                'description' => 'Lenses that filter harmful blue light',
                'base_price' => 2200.00,
                'specifications' => [
                    'index' => '1.5',
                    'blue_light_filter' => true
                ],
                'sort_order' => 6,
            ],
        ];

        foreach ($lensTypes as $lensType) {
            LensType::firstOrCreate(
                ['slug' => $lensType['slug']],
                $lensType
            );
        }
    }
}

