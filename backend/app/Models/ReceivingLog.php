<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReceivingLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'purchase_order_id',
        'purchase_order_item_id',
        'product_id',
        'branch_id',
        'branch_stock_id',
        'quantity_received',
        'quantity_damaged',
        'batch_number',
        'expiry_date',
        'manufacturing_date',
        'unit_cost',
        'total_cost',
        'notes',
        'damage_description',
        'received_by',
        'received_at',
    ];

    protected $casts = [
        'quantity_received' => 'integer',
        'quantity_damaged' => 'integer',
        'unit_cost' => 'decimal:2',
        'total_cost' => 'decimal:2',
        'expiry_date' => 'date',
        'manufacturing_date' => 'date',
        'received_at' => 'datetime',
    ];

    /**
     * Get the purchase order for this log
     */
    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    /**
     * Get the purchase order item
     */
    public function purchaseOrderItem(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrderItem::class);
    }

    /**
     * Get the product
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * Get the branch
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
     * Get the user who received this
     */
    public function receivedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }
}



