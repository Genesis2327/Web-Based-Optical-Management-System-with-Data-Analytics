<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class EOLens extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'eo_lenses';

    protected $fillable = [
        'name',
        'sku',
        'category_id',
        'description',
        'base_curve',
        'diameter',
        'power',
        'material',
        'color',
        'water_content',
        'replacement_schedule',
        'brand',
        'manufacturer',
        'unit_price',
        'wholesale_price',
        'retail_price',
        'stock_quantity',
        'min_stock_threshold',
        'is_active',
        'branch_id',
        'image_paths',
        'specifications',
        'features',
    ];

    protected $casts = [
        'unit_price' => 'decimal:2',
        'wholesale_price' => 'decimal:2',
        'retail_price' => 'decimal:2',
        'base_curve' => 'decimal:2',
        'diameter' => 'decimal:2',
        'power' => 'decimal:2',
        'water_content' => 'integer',
        'stock_quantity' => 'integer',
        'min_stock_threshold' => 'integer',
        'is_active' => 'boolean',
        'image_paths' => 'array',
        'specifications' => 'array',
        'features' => 'array',
    ];

    /**
     * Get the category for this EO lens
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(ProductCategory::class, 'category_id');
    }

    /**
     * Get the branch for this EO lens
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * Scope to get only active EO lenses
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to filter by category
     */
    public function scopeByCategory($query, $categoryId)
    {
        return $query->where('category_id', $categoryId);
    }

    /**
     * Scope to filter by branch
     */
    public function scopeByBranch($query, $branchId)
    {
        return $query->where('branch_id', $branchId);
    }

    /**
     * Check if EO lens is in stock
     */
    public function isInStock(): bool
    {
        return $this->stock_quantity > 0;
    }

    /**
     * Check if EO lens is low stock
     */
    public function isLowStock(): bool
    {
        return $this->stock_quantity > 0 && $this->stock_quantity <= $this->min_stock_threshold;
    }

    /**
     * Get formatted price
     */
    public function getFormattedPriceAttribute(): string
    {
        return 'P ' . number_format($this->retail_price ?? $this->unit_price, 2, '.', ',');
    }
}

