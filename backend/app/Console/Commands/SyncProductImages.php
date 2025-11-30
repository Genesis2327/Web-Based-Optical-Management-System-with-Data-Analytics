<?php

namespace App\Console\Commands;

use App\Models\Product;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class SyncProductImages extends Command
{
    protected $signature = 'products:sync-images {--dry-run : Show what would be updated without making changes}';
    protected $description = 'Sync product images from storage directory to database';

    public function handle()
    {
        $dryRun = $this->option('dry-run');
        
        $this->info('Scanning storage/app/public/products for images...');
        
        // Get all image files from storage
        // Try both methods: Storage facade and direct filesystem
        $imageFiles = [];
        
        // Method 1: Use Storage facade
        try {
            $imageFiles = Storage::disk('public')->files('products');
        } catch (\Exception $e) {
            $this->warn("Storage facade failed: " . $e->getMessage());
        }
        
        // Method 2: Direct filesystem access (check both backend/storage and root storage)
        $possiblePaths = [
            storage_path('app/public/products'), // backend/storage/app/public/products
            base_path('../storage/app/public/products'), // root storage/app/public/products
            base_path('storage/app/public/products'), // alternative root path
        ];
        
        foreach ($possiblePaths as $productsPath) {
            if (is_dir($productsPath)) {
                $this->info("Found images directory: {$productsPath}");
                $directFiles = glob($productsPath . '/*.{jpg,jpeg,png,JPG,JPEG,PNG}', GLOB_BRACE);
                if ($directFiles) {
                    // Convert to relative paths for Laravel storage
                    foreach ($directFiles as $file) {
                        $relativePath = 'products/' . basename($file);
                        if (!in_array($relativePath, $imageFiles)) {
                            $imageFiles[] = $relativePath;
                        }
                    }
                }
                break; // Use first found path
            }
        }
        
        $this->info("Found " . count($imageFiles) . " image files");
        
        // Group images by product (assuming filename pattern: {timestamp}_{index}_IMG_{number}.JPG)
        $imagesByProduct = [];
        
        foreach ($imageFiles as $file) {
            $filename = basename($file);
            
            // Try to extract product identifier from filename
            // Pattern: {timestamp}_{index}_IMG_{number}.JPG
            if (preg_match('/^(\d+)_(\d+)_/', $filename, $matches)) {
                $timestamp = $matches[1];
                $index = (int)$matches[2];
                
                // Use timestamp as product identifier (or you might need a different strategy)
                if (!isset($imagesByProduct[$timestamp])) {
                    $imagesByProduct[$timestamp] = [];
                }
                
                $imagesByProduct[$timestamp][$index] = $file;
            } else {
                // For other filename patterns, try to match by similar names
                $baseName = pathinfo($filename, PATHINFO_FILENAME);
                $parts = explode('_', $baseName);
                
                if (count($parts) >= 2) {
                    $key = $parts[0] . '_' . $parts[1];
                    if (!isset($imagesByProduct[$key])) {
                        $imagesByProduct[$key] = [];
                    }
                    $imagesByProduct[$key][] = $file;
                }
            }
        }
        
        $this->info("Grouped into " . count($imagesByProduct) . " potential product groups");
        
        // Get all products
        $products = Product::all();
        $this->info("Found " . $products->count() . " products in database");
        
        // Group images by timestamp (first number in filename)
        $imageGroups = [];
        foreach ($imageFiles as $file) {
            $filename = basename($file);
            if (preg_match('/^(\d+)_/', $filename, $matches)) {
                $timestamp = $matches[1];
                if (!isset($imageGroups[$timestamp])) {
                    $imageGroups[$timestamp] = [];
                }
                $imageGroups[$timestamp][] = $file;
            }
        }
        
        // Sort each group by index
        foreach ($imageGroups as $timestamp => $files) {
            usort($files, function($a, $b) {
                $aFile = basename($a);
                $bFile = basename($b);
                preg_match('/^\d+_(\d+)_/', $aFile, $aMatch);
                preg_match('/^\d+_(\d+)_/', $bFile, $bMatch);
                $aIndex = isset($aMatch[1]) ? (int)$aMatch[1] : 999;
                $bIndex = isset($bMatch[1]) ? (int)$bMatch[1] : 999;
                return $aIndex <=> $bIndex;
            });
            $imageGroups[$timestamp] = $files;
        }
        
        // Convert groups to flat array for sequential assignment
        $availableImageGroups = array_values($imageGroups);
        $currentGroupIndex = 0;
        
        $updated = 0;
        $skipped = 0;
        
        foreach ($products as $product) {
            $currentImages = $product->image_paths ?? [];
            
            // If product already has images, skip unless they're empty
            if (!empty($currentImages) && is_array($currentImages) && count($currentImages) > 0) {
                $this->line("Product #{$product->id} ({$product->name}) already has " . count($currentImages) . " images - skipping");
                $skipped++;
                continue;
            }
            
            // Assign images to this product
            $productImages = [];
            
            // Assign next available image group to this product
            if ($currentGroupIndex < count($availableImageGroups)) {
                $productImages = $availableImageGroups[$currentGroupIndex];
                $currentGroupIndex++;
            }
            
            if (!empty($productImages)) {
                // Sort images to maintain order
                sort($productImages);
                
                if ($dryRun) {
                    $this->info("Would update Product #{$product->id} ({$product->name}) with " . count($productImages) . " images:");
                    foreach ($productImages as $img) {
                        $this->line("  - {$img}");
                    }
                } else {
                    $product->image_paths = $productImages;
                    $product->image_order = $productImages;
                    if (!empty($productImages)) {
                        $product->primary_image = $productImages[0];
                    }
                    $product->save();
                    
                    $this->info("Updated Product #{$product->id} ({$product->name}) with " . count($productImages) . " images");
                }
                $updated++;
            } else {
                $this->line("No images found for Product #{$product->id} ({$product->name})");
            }
        }
        
        $this->info("\nSummary:");
        $this->info("Updated: {$updated}");
        $this->info("Skipped: {$skipped}");
        
        if ($dryRun) {
            $this->warn("\nThis was a dry run. Run without --dry-run to apply changes.");
        }
        
        return 0;
    }
}

