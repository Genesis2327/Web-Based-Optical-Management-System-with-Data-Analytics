<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DiscountPackageUsage extends Model
{
    use HasFactory;

    protected $fillable = [
        'discount_package_id',
        'user_id',
        'transaction_id',
        'discount_amount',
    ];

    protected $casts = [
        'discount_amount' => 'decimal:2',
    ];

    /**
     * Get the discount package
     */
    public function discountPackage(): BelongsTo
    {
        return $this->belongsTo(DiscountPackage::class);
    }

    /**
     * Get the user who used the discount
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the transaction
     */
    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }
}

