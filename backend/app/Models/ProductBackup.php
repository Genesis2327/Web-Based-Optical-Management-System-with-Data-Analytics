<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProductBackup extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'original_product_id',
        'name',
        'description',
        'price',
        'image_paths',
        'image_order',
        'stock_quantity',
        'is_active',
        'created_by',
        'created_by_role',
        'expiry_date',
        'min_stock_threshold',
        'auto_restock_quantity',
        'auto_restock_enabled',
        'approval_status',
        'branch_id',
        'category_id',
        'image_metadata',
        'primary_image',
        'secondary_image',
        'attributes',
        'brand',
        'model',
        'sku',
        'color',
        'shape',
        'lens_width',
        'bridge_width',
        'temple_length',
        'frame_material',
        'lens_material',
        'lens_type',
        'polarized',
        'uv_protection',
        'gender',
        'prescription_file_path',
        'backed_up_by',
        'backup_reason',
        'backed_up_at',
        'is_restored',
    ];

    protected $casts = [
        'image_paths' => 'array',
        'image_order' => 'array',
        'image_metadata' => 'array',
        'attributes' => 'array',
        'price' => 'decimal:2',
        'lens_width' => 'decimal:2',
        'bridge_width' => 'decimal:2',
        'temple_length' => 'decimal:2',
        'is_active' => 'boolean',
        'stock_quantity' => 'integer',
        'polarized' => 'boolean',
        'uv_protection' => 'boolean',
        'expiry_date' => 'date',
        'min_stock_threshold' => 'integer',
        'auto_restock_quantity' => 'integer',
        'auto_restock_enabled' => 'boolean',
        'backed_up_at' => 'datetime',
        'is_restored' => 'boolean',
    ];

    /**
     * Get the original product (if it still exists)
     */
    public function originalProduct(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'original_product_id');
    }

    /**
     * Get the user who created the backup
     */
    public function backedUpBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'backed_up_by');
    }

    /**
     * Get the creator of the original product
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the branch for this backup
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * Get the category for this backup
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(ProductCategory::class);
    }
}
