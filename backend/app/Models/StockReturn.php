<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class StockReturn extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'product_id',
        'branch_id',
        'return_type',
        'quantity',
        'unit_cost',
        'total_cost',
        'reason',
        'return_reference',
        'status',
        'approved_by',
        'approved_at',
        'product_condition',
        'admin_notes',
        'created_by',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'unit_cost' => 'decimal:2',
        'total_cost' => 'decimal:2',
        'product_condition' => 'json',
        'approved_at' => 'datetime',
    ];

    protected $enumValues = [
        'return_type' => ['defective', 'damaged', 'expired', 'other'],
        'status' => ['pending', 'approved', 'rejected', 'processed'],
    ];

    /**
     * Get the product that this return is for.
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * Get the branch where this return originated.
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * Get the user who approved this return.
     */
    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    /**
     * Get the user who created this return request.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Automatically calculate total cost when quantity or unit_cost changes
     */
    protected static function booted(): void
    {
        static::saving(function (StockReturn $stockReturn) {
            if ($stockReturn->quantity && $stockReturn->unit_cost) {
                $stockReturn->total_cost = $stockReturn->quantity * $stockReturn->unit_cost;
            }
        });
    }

    /**
     * Check if this return is pending approval
     */
    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    /**
     * Check if this return has been approved
     */
    public function isApproved(): bool
    {
        return $this->status === 'approved';
    }

    /**
     * Check if this return has been rejected
     */
    public function isRejected(): bool
    {
        return $this->status === 'rejected';
    }

    /**
     * Check if this return has been processed
     */
    public function isProcessed(): bool
    {
        return $this->status === 'processed';
    }

    /**
     * Scope for pending returns
     */
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    /**
     * Scope for approved returns
     */
    public function scopeApproved($query)
    {
        return $query->where('status', 'approved');
    }

    /**
     * Scope for returns by branch
     */
    public function scopeByBranch($query, $branchId)
    {
        return $query->where('branch_id', $branchId);
    }

    /**
     * Scope for returns by product
     */
    public function scopeByProduct($query, $productId)
    {
        return $query->where('product_id', $productId);
    }
}
