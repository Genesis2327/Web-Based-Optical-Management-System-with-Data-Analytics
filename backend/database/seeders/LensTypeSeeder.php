<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\LensType;

class LensTypeSeeder extends Seeder
{
    public function run(): void
    {
        // Default 3 lens types
        $defaultLensTypes = [
            [
                'name' => 'Ordinary Lens',
                'slug' => 'ordinary',
                'category' => 'specialty',
                'description' => 'Standard ordinary lenses for everyday use',
                'base_price' => 1500.00,
                'specifications' => [
                    'index' => '1.5',
                    'type' => 'standard'
                ],
                'is_active' => true,
                'sort_order' => 1,
            ],
            [
                'name' => 'Anti-Radiation Lens',
                'slug' => 'anti_radiation',
                'category' => 'specialty',
                'description' => 'Lenses with anti-radiation coating to protect eyes from harmful radiation and blue light',
                'base_price' => 2500.00,
                'specifications' => [
                    'index' => '1.5',
                    'anti_radiation' => true,
                    'blue_light_filter' => true
                ],
                'is_active' => true,
                'sort_order' => 2,
            ],
            [
                'name' => 'Photochromic Lens',
                'slug' => 'photochromic',
                'category' => 'specialty',
                'description' => 'Lenses that automatically darken in sunlight and lighten indoors',
                'base_price' => 3000.00,
                'specifications' => [
                    'index' => '1.5',
                    'tint_type' => 'transition',
                    'photochromic' => true
                ],
                'is_active' => true,
                'sort_order' => 3,
            ],
        ];

        // Create or update the 3 default lens types
        foreach ($defaultLensTypes as $lensType) {
            // Check if lens type exists (including soft-deleted)
            $existing = LensType::withTrashed()->where('slug', $lensType['slug'])->first();
            
            if ($existing) {
                // If soft-deleted, restore it
                if ($existing->trashed()) {
                    $existing->restore();
                }
                // Update the existing record
                $existing->update($lensType);
            } else {
                // Create new record
                LensType::create($lensType);
            }
        }
    }
}

