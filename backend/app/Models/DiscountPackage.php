<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Carbon\Carbon;

class DiscountPackage extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'code',
        'description',
        'discount_type',
        'discount_value',
        'minimum_purchase',
        'maximum_discount',
        'start_date',
        'end_date',
        'usage_limit',
        'usage_limit_per_user',
        'is_active',
        'applicable_categories',
        'applicable_products',
    ];

    protected $casts = [
        'discount_value' => 'decimal:2',
        'minimum_purchase' => 'decimal:2',
        'maximum_discount' => 'decimal:2',
        'start_date' => 'date',
        'end_date' => 'date',
        'usage_limit' => 'integer',
        'usage_limit_per_user' => 'integer',
        'is_active' => 'boolean',
        'applicable_categories' => 'array',
        'applicable_products' => 'array',
    ];

    /**
     * Get usage records for this discount package
     */
    public function usages(): HasMany
    {
        return $this->hasMany(DiscountPackageUsage::class);
    }

    /**
     * Check if discount is currently valid
     */
    public function isValid(): bool
    {
        if (!$this->is_active) {
            return false;
        }

        $now = Carbon::now();

        if ($this->start_date && $now->lt($this->start_date)) {
            return false;
        }

        if ($this->end_date && $now->gt($this->end_date)) {
            return false;
        }

        if ($this->usage_limit && $this->usages()->count() >= $this->usage_limit) {
            return false;
        }

        return true;
    }

    /**
     * Check if user can use this discount
     */
    public function canBeUsedBy(int $userId): bool
    {
        if (!$this->isValid()) {
            return false;
        }

        if ($this->usage_limit_per_user) {
            $userUsageCount = $this->usages()->where('user_id', $userId)->count();
            if ($userUsageCount >= $this->usage_limit_per_user) {
                return false;
            }
        }

        return true;
    }

    /**
     * Calculate discount amount for a given purchase amount
     */
    public function calculateDiscount(float $purchaseAmount): float
    {
        if (!$this->isValid()) {
            return 0;
        }

        if ($this->minimum_purchase && $purchaseAmount < $this->minimum_purchase) {
            return 0;
        }

        $discount = 0;

        if ($this->discount_type === 'percentage') {
            $discount = $purchaseAmount * ($this->discount_value / 100);
        } else {
            $discount = $this->discount_value;
        }

        // Apply maximum discount limit if set
        if ($this->maximum_discount && $discount > $this->maximum_discount) {
            $discount = $this->maximum_discount;
        }

        return min($discount, $purchaseAmount); // Can't discount more than purchase amount
    }

    /**
     * Scope to get only active packages
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to get currently valid packages
     */
    public function scopeValid($query)
    {
        $now = Carbon::now();
        return $query->where('is_active', true)
                    ->where(function($q) use ($now) {
                        $q->whereNull('start_date')
                          ->orWhere('start_date', '<=', $now);
                    })
                    ->where(function($q) use ($now) {
                        $q->whereNull('end_date')
                          ->orWhere('end_date', '>=', $now);
                    });
    }
}

