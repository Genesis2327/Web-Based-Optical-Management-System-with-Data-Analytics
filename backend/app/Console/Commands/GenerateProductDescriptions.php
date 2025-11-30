<?php

namespace App\Console\Commands;

use App\Models\Product;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class GenerateProductDescriptions extends Command
{
    protected $signature = 'products:generate-descriptions 
                            {--openai-key= : OpenAI API key (or set OPENAI_API_KEY in .env)}
                            {--dry-run : Show what would be updated without making changes}
                            {--output-sql : Output SQL UPDATE statements instead of updating database}
                            {--force : Update products even if they already have descriptions}';

    protected $description = 'Generate product descriptions from images using AI analysis or metadata';

    public function handle()
    {
        $this->info('========================================');
        $this->info('Generate Product Descriptions from Images');
        $this->info('========================================');
        $this->newLine();

        // Check for OpenAI API key
        $openaiKey = $this->option('openai-key') ?: env('OPENAI_API_KEY');
        $useOpenAI = !empty($openaiKey);
        $dryRun = $this->option('dry-run');
        $outputSql = $this->option('output-sql');
        $force = $this->option('force');

        if ($useOpenAI) {
            $this->info('✓ OpenAI API key found - Using AI image analysis');
        } else {
            $this->warn('⚠ OpenAI API key not found - Using basic metadata-based descriptions');
            $this->line('   Set OPENAI_API_KEY in your .env file or use --openai-key option');
        }
        $this->newLine();

        // Build query for products needing descriptions
        $query = Product::query();
        
        if (!$force) {
            $query->where(function($q) {
                $q->whereNull('description')
                  ->orWhere('description', '');
            });
        }
        
        $query->where(function($q) {
            $q->whereNotNull('primary_image')
              ->orWhereNotNull('image_paths');
        });

        $totalProducts = $query->count();
        $this->info("Found {$totalProducts} products" . ($force ? ' (force mode - will update all)' : ' needing descriptions'));

        if ($totalProducts === 0) {
            $this->warn('No products found. Exiting.');
            return 0;
        }

        $this->newLine();

        if ($outputSql) {
            $this->info('SQL OUTPUT MODE - Will output UPDATE statements to console');
            $this->newLine();
            echo "-- Product Description Updates\n";
            echo "-- Generated: " . now()->toDateTimeString() . "\n\n";
        }

        $processed = 0;
        $successful = 0;
        $skipped = 0;
        $errors = 0;

        $products = $query->get();

        $progressBar = $this->output->createProgressBar($totalProducts);
        $progressBar->start();

        foreach ($products as $product) {
            $processed++;
            
            // Get best image for analysis
            $imagePath = $this->getBestImagePath($product);
            
            if (!$imagePath) {
                $skipped++;
                $progressBar->advance();
                continue;
            }
            
            // Generate description
            $description = null;
            
            if ($useOpenAI) {
                $description = $this->generateDescriptionWithOpenAI($imagePath, $openaiKey);
                
                if (!$description) {
                    // Fallback to basic description
                    $description = $this->generateBasicDescription($product);
                }
            } else {
                $description = $this->generateBasicDescription($product);
            }
            
            if (!$description) {
                $errors++;
                $progressBar->advance();
                continue;
            }
            
            // Escape description for SQL
            $escapedDescription = addslashes($description);
            $escapedDescription = str_replace(["\r", "\n"], [' ', ' '], $escapedDescription);
            
            // Update product or output SQL
            if ($outputSql) {
                echo "UPDATE products SET description = '{$escapedDescription}' WHERE id = {$product->id};\n";
                $successful++;
            } else {
                try {
                    if (!$dryRun) {
                        $product->description = $description;
                        $product->save();
                    }
                    $successful++;
                } catch (\Exception $e) {
                    $this->error("\nError updating product {$product->id}: " . $e->getMessage());
                    $errors++;
                }
            }
            
            $progressBar->advance();
            
            // Small delay to avoid rate limiting
            if ($useOpenAI && $processed < $totalProducts) {
                usleep(500000); // 0.5 second delay
            }
        }

        $progressBar->finish();
        $this->newLine(2);

        // Summary
        $this->info('========================================');
        $this->info('Summary');
        $this->info('========================================');
        $this->line("Total processed: {$processed}");
        $this->info("Successful: {$successful}");
        $this->line("Skipped (no images): {$skipped}");
        if ($errors > 0) {
            $this->error("Errors: {$errors}");
        }
        
        if ($dryRun && !$outputSql) {
            $this->warn("\nThis was a dry run. Run without --dry-run to apply changes.");
        }
        
        if ($outputSql) {
            $this->info("\n✓ SQL statements output to console. You can save them to a file and execute.");
        }

        $this->newLine();
        return 0;
    }

    /**
     * Generate description using OpenAI Vision API
     */
    private function generateDescriptionWithOpenAI(string $imagePath, string $apiKey): ?string
    {
        $fullPath = storage_path('app/public/' . $imagePath);
        if (!file_exists($fullPath)) {
            return null;
        }

        try {
            // Read and encode image
            $imageData = file_get_contents($fullPath);
            $base64Image = base64_encode($imageData);
            
            // Get image mime type
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mimeType = finfo_file($finfo, $fullPath);
            finfo_close($finfo);
            
            if (!in_array($mimeType, ['image/jpeg', 'image/png', 'image/gif', 'image/webp'])) {
                return null;
            }

            // Prepare API request
            $url = 'https://api.openai.com/v1/chat/completions';
            $prompt = "Analyze this optical/eyeglass product image and create a detailed, professional product description. 
Include details about:
- Frame style and shape
- Color and material (if visible)
- Design features
- Suitable occasions/use cases
- Target audience (if applicable)

Write in a marketing-friendly tone, 2-3 sentences. Focus on what makes this product appealing to customers.";

            $data = [
                'model' => 'gpt-4o',
                'messages' => [
                    [
                        'role' => 'user',
                        'content' => [
                            [
                                'type' => 'text',
                                'text' => $prompt
                            ],
                            [
                                'type' => 'image_url',
                                'image_url' => [
                                    'url' => "data:{$mimeType};base64,{$base64Image}"
                                ]
                            ]
                        ]
                    ]
                ],
                'max_tokens' => 200
            ];

            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $apiKey
            ]);
            curl_setopt($ch, CURLOPT_TIMEOUT, 30);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);

            if ($httpCode !== 200) {
                if ($httpCode === 0 && !empty($curlError)) {
                    // Connection error, but don't spam console
                    return null;
                }
                return null;
            }

            $result = json_decode($response, true);
            if (isset($result['choices'][0]['message']['content'])) {
                return trim($result['choices'][0]['message']['content']);
            }

            return null;
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Generate basic description from product metadata
     */
    private function generateBasicDescription(Product $product): string
    {
        $parts = [];
        
        // Start with product name
        $parts[] = $product->name;
        
        // Add brand if available
        if ($product->brand) {
            $parts[] = "by {$product->brand}";
        }
        
        // Add frame attributes
        $frameParts = [];
        if ($product->shape) {
            $frameParts[] = $product->shape . " shape";
        }
        if ($product->color) {
            $frameParts[] = $product->color . " color";
        }
        if ($product->frame_material) {
            $frameParts[] = $product->frame_material . " frame";
        }
        if ($product->gender) {
            $frameParts[] = "for " . strtolower($product->gender);
        }
        
        if (count($frameParts) > 0) {
            $parts[] = "featuring " . implode(", ", $frameParts);
        }
        
        // Add lens features
        $lensParts = [];
        if ($product->lens_type) {
            $lensParts[] = $product->lens_type . " lenses";
        }
        if ($product->polarized) {
            $lensParts[] = "polarized";
        }
        if ($product->uv_protection) {
            $lensParts[] = "UV protection";
        }
        
        if (count($lensParts) > 0) {
            $parts[] = "with " . implode(" and ", $lensParts);
        }
        
        $description = implode(". ", $parts);
        $description .= ". A quality optical product perfect for your vision needs.";
        
        return $description;
    }

    /**
     * Get the best image path for analysis
     */
    private function getBestImagePath(Product $product): ?string
    {
        // Try primary image first
        if ($product->primary_image) {
            $fullPath = storage_path('app/public/' . $product->primary_image);
            if (file_exists($fullPath)) {
                return $product->primary_image;
            }
        }
        
        // Try ordered images
        $images = $product->getOrderedImages();
        if (!empty($images)) {
            foreach ($images as $imagePath) {
                $fullPath = storage_path('app/public/' . $imagePath);
                if (file_exists($fullPath)) {
                    return $imagePath;
                }
            }
        }
        
        // Try image_paths
        if ($product->image_paths && is_array($product->image_paths)) {
            foreach ($product->image_paths as $imagePath) {
                $fullPath = storage_path('app/public/' . $imagePath);
                if (file_exists($fullPath)) {
                    return $imagePath;
                }
            }
        }
        
        return null;
    }
}

