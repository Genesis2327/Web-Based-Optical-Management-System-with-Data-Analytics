<?php

namespace App\Models;

use Illuminate\Database\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Schema;

class Schedule extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'staff_id',
        'staff_role',
        'branch_id',
        'day_of_week',
        'days_of_week',
        'start_time',
        'end_time',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'day_of_week' => 'integer',
        'days_of_week' => 'array',
        'is_active' => 'boolean',
    ];

    public function staff(): BelongsTo
    {
        return $this->belongsTo(User::class, 'staff_id');
    }

    public function optometrist(): BelongsTo
    {
        return $this->belongsTo(User::class, 'staff_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeForDay($query, $dayOfWeek)
    {
        return $query->where('day_of_week', $dayOfWeek);
    }

    public function scopeForStaff($query, $staffId)
    {
        return $query->where('staff_id', $staffId);
    }

    public function scopeForRole($query, $role)
    {
        return $query->where('staff_role', $role);
    }

    public function scopeOptometrists($query)
    {
        return $query->where('staff_role', 'optometrist');
    }

    public function scopeStaff($query)
    {
        return $query->where('staff_role', 'staff');
    }

    public function getDayNameAttribute(): string
    {
        $days = [
            1 => 'Monday',
            2 => 'Tuesday',
            3 => 'Wednesday',
            4 => 'Thursday',
            5 => 'Friday',
            6 => 'Saturday',
            7 => 'Sunday',
        ];

        return $days[$this->day_of_week] ?? 'Unknown';
    }

    public function getFormattedStartTimeAttribute(): string
    {
        try {
            $time = strpos($this->start_time, ' ') !== false 
                ? explode(' ', $this->start_time)[1]
                : $this->start_time;

            return date('g:i A', strtotime($time));
        } catch (\Exception $e) {
            return $this->start_time;
        }
    }

    public function getFormattedEndTimeAttribute(): string
    {
        try {
            $time = strpos($this->end_time, ' ') !== false 
                ? explode(' ', $this->end_time)[1]
                : $this->end_time;

            return date('g:i A', strtotime($time));
        } catch (\Exception $e) {
            return $this->end_time;
        }
    }
}
