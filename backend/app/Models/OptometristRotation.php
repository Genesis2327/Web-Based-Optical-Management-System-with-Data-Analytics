<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class OptometristRotation extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'optometrist_id',
        'rotation_schedule',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'rotation_schedule' => 'array',
        'is_active' => 'boolean',
    ];

    /**
     * Get the optometrist that owns the rotation.
     */
    public function optometrist(): BelongsTo
    {
        return $this->belongsTo(User::class, 'optometrist_id');
    }

    /**
     * Get the user who created this rotation.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the user who last updated this rotation.
     */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Get the branch for a specific day.
     */
    public function getBranchForDay(int $dayOfWeek): ?int
    {
        foreach ($this->rotation_schedule as $schedule) {
            if ($schedule['day'] === $dayOfWeek) {
                return $schedule['branch_id'];
            }
        }
        return null;
    }

    /**
     * Get the schedule for a specific day.
     */
    public function getScheduleForDay(int $dayOfWeek): ?array
    {
        foreach ($this->rotation_schedule as $schedule) {
            if ($schedule['day'] === $dayOfWeek) {
                return $schedule;
            }
        }
        return null;
    }

    /**
     * Get all branches this optometrist works at.
     */
    public function getAllBranches(): array
    {
        if (!$this->rotation_schedule || !is_array($this->rotation_schedule)) {
            return [];
        }
        
        $branches = [];
        foreach ($this->rotation_schedule as $schedule) {
            if (is_array($schedule) && isset($schedule['branch_id'])) {
                if (!in_array($schedule['branch_id'], $branches)) {
                    $branches[] = $schedule['branch_id'];
                }
            }
        }
        return $branches;
    }

    /**
     * Get formatted rotation schedule.
     */
    public function getFormattedSchedule(): array
    {
        if (!$this->rotation_schedule || !is_array($this->rotation_schedule)) {
            return [];
        }
        
        $days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        $formatted = [];
        
        foreach ($this->rotation_schedule as $schedule) {
            if (!is_array($schedule)) {
                continue;
            }
            
            $day = $schedule['day'] ?? null;
            $branchId = $schedule['branch_id'] ?? null;
            $startTime = $schedule['start_time'] ?? '';
            $endTime = $schedule['end_time'] ?? '';
            
            if ($day === null || $branchId === null) {
                continue;
            }
            
            $formatted[] = [
                'day' => $day,
                'day_name' => isset($days[$day - 1]) ? $days[$day - 1] : 'Unknown',
                'branch_id' => $branchId,
                'start_time' => $startTime,
                'end_time' => $endTime,
                'formatted_time' => $startTime . ' - ' . $endTime,
            ];
        }
        
        return $formatted;
    }
}