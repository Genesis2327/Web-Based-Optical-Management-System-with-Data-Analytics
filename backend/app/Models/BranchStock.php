<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BranchStock extends Model
{
    protected $table = 'branch_stock';
    
    protected $fillable = [
        'product_id',
        'branch_id',
        'stock_quantity',
        'reserved_quantity',
        'price_override',
        'status',
        'expiry_date',
        'min_stock_threshold',
        'auto_restock_enabled',
        'auto_restock_quantity',
        'last_restock_date',
        'cost_per_unit',
        'average_cost',
        'valuation_method',
        'total_cost_value',
        'location_code',
        'bin_number',
        'adjustment_notes',
        'last_adjustment_data',
    ];

    protected $casts = [
        'stock_quantity' => 'integer',
        'reserved_quantity' => 'integer',
        'price_override' => 'decimal:2',
        'expiry_date' => 'date',
        'min_stock_threshold' => 'integer',
        'auto_restock_enabled' => 'boolean',
        'auto_restock_quantity' => 'integer',
        'last_restock_date' => 'datetime',
        'cost_per_unit' => 'decimal:2',
        'average_cost' => 'decimal:2',
        'total_cost_value' => 'decimal:2',
        'last_adjustment_data' => 'array',
    ];

    /**
     * Get the product for this stock record
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * Get the branch for this stock record
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * Get all inventory transactions for this stock record
     */
    public function transactions(): HasMany
    {
        return $this->hasMany(InventoryTransaction::class, 'branch_stock_id');
    }

    /**
     * Get available quantity (stock - reserved)
     */
    public function getAvailableQuantityAttribute(): int
    {
        return max(0, $this->stock_quantity - $this->reserved_quantity);
    }

    /**
     * Check if product is in stock at this branch
     */
    public function isInStock(): bool
    {
        return $this->available_quantity > 0;
    }

    /**
     * Scope to get only in-stock items
     */
    public function scopeInStock($query)
    {
        return $query->whereRaw('stock_quantity > reserved_quantity');
    }

    /**
     * Scope to get low stock items (less than min threshold)
     */
    public function scopeLowStock($query)
    {
        return $query->whereRaw('(stock_quantity - reserved_quantity) <= min_stock_threshold');
    }

    /**
     * Scope to get expiring soon items (within 30 days)
     */
    public function scopeExpiringSoon($query, $days = 30)
    {
        return $query->where('expiry_date', '<=', now()->addDays($days))
                    ->where('expiry_date', '>', now());
    }

    /**
     * Scope to get expired items
     */
    public function scopeExpired($query)
    {
        return $query->where('expiry_date', '<', now());
    }

    /**
     * Scope to get items with auto-restock enabled
     */
    public function scopeAutoRestockEnabled($query)
    {
        return $query->where('auto_restock_enabled', true);
    }

    /**
     * Check if item needs restock
     */
    public function needsRestock(): bool
    {
        return $this->available_quantity <= $this->min_stock_threshold;
    }

    /**
     * Check if item is expiring soon
     */
    public function isExpiringSoon($days = 30): bool
    {
        return $this->expiry_date && 
               $this->expiry_date <= now()->addDays($days) && 
               $this->expiry_date > now();
    }

    /**
     * Check if item is expired
     */
    public function isExpired(): bool
    {
        return $this->expiry_date && $this->expiry_date < now();
    }

    /**
     * Auto-calculate and update status based on available quantity
     */
    public function updateStatus(): void
    {
        $availableQuantity = $this->available_quantity;
        $minThreshold = $this->min_stock_threshold ?? 5; // Default to 5 if NULL
        
        if ($availableQuantity <= 0) {
            $this->status = 'Out of Stock';
        } elseif ($availableQuantity <= $minThreshold) {
            $this->status = 'Low Stock';
        } else {
            $this->status = 'In Stock';
        }
        
        // Use updateQuietly to avoid triggering events and infinite loops
        $this->updateQuietly(['status' => $this->status]);
    }

    /**
     * Get the effective price (price_override if set, otherwise product's base price)
     * Note: This accessor can cause circular queries, use direct calculation instead
     */
    public function getEffectivePrice($productPrice = null): float
    {
        if ($this->price_override !== null) {
            return (float) $this->price_override;
        }
        
        return (float) ($productPrice ?? $this->product->price);
    }

    /**
     * Boot method to auto-update status when stock changes
     */
    protected static function boot()
    {
        parent::boot();
        
        static::saved(function ($branchStock) {
            $branchStock->updateStatus();
        });
    }
}
