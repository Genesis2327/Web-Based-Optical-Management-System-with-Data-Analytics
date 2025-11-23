<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Policy extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'type',
        'version',
        'title',
        'content',
        'is_active',
        'effective_date',
        'created_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'effective_date' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the user who created this policy
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Scope to get active policies
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to get policies by type
     */
    public function scopeOfType($query, string $type)
    {
        return $query->where('type', $type);
    }

    /**
     * Get the latest version of a policy type
     */
    public static function getLatest(string $type): ?self
    {
        return self::ofType($type)
            ->active()
            ->orderBy('effective_date', 'desc')
            ->orderBy('created_at', 'desc')
            ->first();
    }

    /**
     * Activate this policy and deactivate others of the same type
     */
    public function activate(): void
    {
        // Deactivate all other policies of the same type
        self::where('type', $this->type)
            ->where('id', '!=', $this->id)
            ->update(['is_active' => false]);

        // Activate this policy
        $this->update(['is_active' => true]);
    }
}

