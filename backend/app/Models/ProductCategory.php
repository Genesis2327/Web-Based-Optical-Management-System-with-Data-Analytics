<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProductCategory extends Model
{
    use SoftDeletes;
    protected $fillable = [
        'name',
        'slug',
        'description',
        'image',
        'icon',
        'color',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    /**
     * Get all products in this category
     */
    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    /**
     * Scope to get only active categories
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to order by sort order
     */
    public function scopeOrdered($query)
    {
        return $query->orderBy('sort_order')->orderBy('name');
    }

    /**
     * Get the route key for the model
     */
    public function getRouteKeyName()
    {
        return 'slug';
    }

    /**
     * Get formatted attributes for frontend
     */
    public function getFormattedAttributesAttribute(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description ?? null,
            'image' => $this->image ?? null,
            'icon' => $this->icon ?? null,
            'color' => $this->color ?? '#3B82F6',
            'is_active' => $this->is_active ?? true,
            'sort_order' => $this->sort_order ?? 0,
            'product_count' => \Illuminate\Support\Facades\Schema::hasTable('products') && \Illuminate\Support\Facades\Schema::hasColumn('products', 'category_id')
                ? $this->products()->count()
                : 0,
        ];
    }
}




