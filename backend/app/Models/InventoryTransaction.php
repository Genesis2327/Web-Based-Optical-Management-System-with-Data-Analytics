<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class InventoryTransaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id',
        'branch_id',
        'branch_stock_id',
        'transaction_type',
        'quantity_change',
        'previous_quantity',
        'new_quantity',
        'reference_type',
        'reference_id',
        'adjustment_reason',
        'notes',
        'reason',
        'performed_by',
        'performed_by_role',
        'cost_per_unit',
        'total_cost',
    ];

    protected $casts = [
        'quantity_change' => 'integer',
        'previous_quantity' => 'integer',
        'new_quantity' => 'integer',
        'cost_per_unit' => 'decimal:2',
        'total_cost' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the product for this transaction
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * Get the branch for this transaction
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * Get the branch stock record
     */
    public function branchStock(): BelongsTo
    {
        return $this->belongsTo(BranchStock::class);
    }

    /**
     * Get the user who performed this transaction
     */
    public function performedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'performed_by');
    }

    /**
     * Get the reference model (polymorphic)
     */
    public function reference(): MorphTo
    {
        return $this->morphTo('reference');
    }

    /**
     * Scope for filtering by transaction type
     */
    public function scopeOfType($query, string $type)
    {
        return $query->where('transaction_type', $type);
    }

    /**
     * Scope for filtering by product
     */
    public function scopeForProduct($query, int $productId)
    {
        return $query->where('product_id', $productId);
    }

    /**
     * Scope for filtering by branch
     */
    public function scopeForBranch($query, int $branchId)
    {
        return $query->where('branch_id', $branchId);
    }

    /**
     * Scope for filtering by date range
     */
    public function scopeDateRange($query, $startDate, $endDate)
    {
        return $query->whereBetween('created_at', [$startDate, $endDate]);
    }

    /**
     * Scope for adjustments only
     */
    public function scopeAdjustments($query)
    {
        return $query->where('transaction_type', 'adjustment');
    }

    /**
     * Scope for receipts only
     */
    public function scopeReceipts($query)
    {
        return $query->where('transaction_type', 'receipt');
    }
}



