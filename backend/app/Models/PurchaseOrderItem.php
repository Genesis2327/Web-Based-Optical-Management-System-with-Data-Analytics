<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PurchaseOrderItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'purchase_order_id',
        'product_id',
        'quantity_ordered',
        'quantity_received',
        'quantity_damaged',
        'quantity_returned',
        'unit_cost',
        'total_cost',
        'batch_number',
        'expiry_date',
        'manufacturing_date',
        'notes',
    ];

    protected $casts = [
        'quantity_ordered' => 'integer',
        'quantity_received' => 'integer',
        'quantity_damaged' => 'integer',
        'quantity_returned' => 'integer',
        'unit_cost' => 'decimal:2',
        'total_cost' => 'decimal:2',
        'expiry_date' => 'date',
    ];

    /**
     * Get the purchase order for this item
     */
    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    /**
     * Get the product for this item
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * Get all receiving logs for this item
     */
    public function receivingLogs(): HasMany
    {
        return $this->hasMany(ReceivingLog::class);
    }

    /**
     * Calculate total cost
     */
    public function calculateTotalCost(): void
    {
        $this->total_cost = $this->quantity_ordered * $this->unit_cost;
    }

    /**
     * Get remaining quantity to receive
     */
    public function getRemainingQuantityAttribute(): int
    {
        return max(0, $this->quantity_ordered - $this->quantity_received - $this->quantity_damaged - $this->quantity_returned);
    }

    /**
     * Check if item is fully received
     */
    public function isFullyReceived(): bool
    {
        $totalReceived = $this->quantity_received + $this->quantity_damaged + $this->quantity_returned;
        return $totalReceived >= $this->quantity_ordered;
    }
}



