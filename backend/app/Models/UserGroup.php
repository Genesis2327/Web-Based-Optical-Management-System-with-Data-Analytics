<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class UserGroup extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'description',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * Get users in this group
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_group_members')
                    ->withTimestamps();
    }

    /**
     * Scope to get only active groups
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}

