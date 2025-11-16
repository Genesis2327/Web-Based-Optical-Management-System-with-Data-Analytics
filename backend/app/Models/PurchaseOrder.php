<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseOrder extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'po_number',
        'supplier_id',
        'branch_id',
        'order_date',
        'expected_delivery_date',
        'actual_delivery_date',
        'status',
        'subtotal',
        'tax_amount',
        'shipping_cost',
        'discount_amount',
        'total_amount',
        'notes',
        'internal_notes',
        'created_by',
        'approved_by',
        'approved_at',
    ];

    protected $casts = [
        'order_date' => 'date',
        'expected_delivery_date' => 'date',
        'actual_delivery_date' => 'date',
        'subtotal' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'shipping_cost' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'approved_at' => 'datetime',
    ];

    /**
     * Boot method to generate PO number
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($po) {
            if (empty($po->po_number)) {
                $po->po_number = static::generatePONumber();
            }
        });
    }

    /**
     * Generate unique PO number
     */
    public static function generatePONumber(): string
    {
        $date = now()->format('Ymd');
        $prefix = "PO-{$date}-";
        
        $lastPO = static::where('po_number', 'like', $prefix . '%')
            ->orderBy('po_number', 'desc')
            ->first();
        
        if ($lastPO) {
            $lastNumber = (int) substr($lastPO->po_number, -4);
            $newNumber = $lastNumber + 1;
        } else {
            $newNumber = 1;
        }
        
        return $prefix . str_pad($newNumber, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Get the supplier for this PO
     */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    /**
     * Get the branch for this PO
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * Get all items for this PO
     */
    public function items(): HasMany
    {
        return $this->hasMany(PurchaseOrderItem::class);
    }

    /**
     * Get the user who created this PO
     */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the user who approved this PO
     */
    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    /**
     * Calculate totals from items
     */
    public function calculateTotals(): void
    {
        $subtotal = $this->items->sum('total_cost');
        $this->subtotal = $subtotal;
        $this->total_amount = $subtotal + $this->tax_amount + $this->shipping_cost - $this->discount_amount;
    }

    /**
     * Check if PO is fully received
     */
    public function isFullyReceived(): bool
    {
        return $this->items->every(function ($item) {
            return $item->quantity_received >= $item->quantity_ordered;
        });
    }

    /**
     * Check if PO is partially received
     */
    public function isPartiallyReceived(): bool
    {
        return $this->items->some(function ($item) {
            return $item->quantity_received > 0 && $item->quantity_received < $item->quantity_ordered;
        });
    }

    /**
     * Scope for pending POs
     */
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    /**
     * Scope for received POs
     */
    public function scopeReceived($query)
    {
        return $query->where('status', 'received');
    }
}

