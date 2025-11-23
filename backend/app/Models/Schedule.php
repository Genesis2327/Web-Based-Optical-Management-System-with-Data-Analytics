<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Schema;

class Schedule extends Model
{
    use HasFactory;
    

    protected $fillable = [
        'staff_id',
        'staff_role',
        'branch_id',
        'day_of_week', // Keep for backward compatibility
        'days_of_week', // New field for multiple days
        'start_time',
        'end_time',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'day_of_week' => 'integer', // Keep for backward compatibility
        'days_of_week' => 'array', // New field for multiple days
        'is_active' => 'boolean',
    ];

    /**
     * Get the staff member that owns the schedule.
     */
    public function staff(): BelongsTo
    {
        return $this->belongsTo(User::class, 'staff_id');
    }

    /**
     * Get the optometrist that owns the schedule (for backward compatibility).
     */
    public function optometrist(): BelongsTo
    {
        return $this->belongsTo(User::class, 'staff_id');
    }

    /**
     * Get the branch that owns the schedule.
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * Get the user who created this schedule.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the user who last updated this schedule.
     */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Scope to get active schedules.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to get schedules for a specific day.
     */
    public function scopeForDay($query, $dayOfWeek)
    {
        return $query->where('day_of_week', $dayOfWeek);
    }

    /**
     * Scope to get schedules for a specific staff member.
     */
    public function scopeForStaff($query, $staffId)
    {
        return $query->where('staff_id', $staffId);
    }

    /**
     * Scope to get schedules for a specific staff role.
     */
    public function scopeForRole($query, $role)
    {
        return $query->where('staff_role', $role);
    }

    /**
     * Scope to get schedules for optometrists.
     */
    public function scopeOptometrists($query)
    {
        return $query->where('staff_role', 'optometrist');
    }

    /**
     * Scope to get schedules for staff.
     */
    public function scopeStaff($query)
    {
        return $query->where('staff_role', 'staff');
    }

    /**
     * Get day name from day of week number.
     */
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

    /**
     * Format time to 12-hour AM/PM format.
     */
    public function getFormattedStartTimeAttribute(): string
    {
        try {
            // Extract just the time part if it's a datetime string
            $time = $this->start_time;
            if (strpos($time, ' ') !== false) {
                // If it contains a space, it's a datetime string, extract time part
                $parts = explode(' ', $time);
                $time = $parts[1];
            }
            return date('g:i A', strtotime($time));
        } catch (\Exception $e) {
            return $this->start_time;
        }
    }

    /**
     * Format time to 12-hour AM/PM format.
     */
    public function getFormattedEndTimeAttribute(): string
    {
        try {
            // Extract just the time part if it's a datetime string
            $time = $this->end_time;
            if (strpos($time, ' ') !== false) {
                // If it contains a space, it's a datetime string, extract time part
                $parts = explode(' ', $time);
                $time = $parts[1];
            }
            return date('g:i A', strtotime($time));
        } catch (\Exception $e) {
            return $this->end_time;
        }
    }
}