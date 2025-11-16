<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class RestockRequest extends Model
{
    use SoftDeletes;
    protected $fillable = [
        'branch_id',
        'product_id',
        'requested_by',
        'current_stock',
        'requested_quantity',
        'status',
        'notes',
        'approved_by',
        'approved_at',
        'fulfilled_at',
        'auto_generated',
    ];

    protected $casts = [
        'current_stock' => 'integer',
        'requested_quantity' => 'integer',
        'approved_at' => 'datetime',
        'fulfilled_at' => 'datetime',
        'auto_generated' => 'boolean',
    ];

    /**
     * Get the branch for this restock request
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * Get the product for this restock request
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * Get the user who requested the restock
     */
    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    /**
     * Get the user who approved the restock
     */
    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    /**
     * Check if the request is pending
     */
    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    /**
     * Check if the request is approved
     */
    public function isApproved(): bool
    {
        return $this->status === 'approved';
    }

    /**
     * Check if the request is rejected
     */
    public function isRejected(): bool
    {
        return $this->status === 'rejected';
    }

    /**
     * Check if the request is fulfilled
     */
    public function isFulfilled(): bool
    {
        return $this->status === 'fulfilled';
    }
}
