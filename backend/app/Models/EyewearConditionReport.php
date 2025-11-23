<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class EyewearConditionReport extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'product_id',
        'reservation_id',
        'transaction_id',
        'branch_id',
        'product_type',
        'condition_issues',
        'condition_status',
        'report_status',
        'photo_paths',
        'remarks',
        'assigned_staff_id',
        'assigned_optometrist_id',
        'resolution_notes',
        'resolved_at',
        'resolved_by',
        'contact_lens_expiry',
        'contact_lens_cycle_days',
        'last_replacement_date',
    ];

    protected $casts = [
        'condition_issues' => 'array',
        'photo_paths' => 'array',
        'resolved_at' => 'datetime',
        'contact_lens_expiry' => 'date',
        'last_replacement_date' => 'date',
        'contact_lens_cycle_days' => 'integer',
    ];

    /**
     * Get the user (customer) who created this report.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the product this report is about.
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * Get the reservation this report is related to.
     */
    public function reservation(): BelongsTo
    {
        return $this->belongsTo(Reservation::class);
    }

    /**
     * Get the transaction this report is related to.
     */
    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    /**
     * Get the branch this report is for.
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * Get the staff member assigned to this report.
     */
    public function assignedStaff(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_staff_id');
    }

    /**
     * Get the optometrist assigned to this report.
     */
    public function assignedOptometrist(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_optometrist_id');
    }

    /**
     * Get the user who resolved this report.
     */
    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    /**
     * Check if the condition affects vision.
     */
    public function isVisionAffected(): bool
    {
        return $this->condition_status === 'vision_affected' || $this->condition_status === 'urgent';
    }

    /**
     * Check if report needs optometrist attention.
     */
    public function needsOptometrist(): bool
    {
        return $this->isVisionAffected() && $this->report_status !== 'resolved';
    }

    /**
     * Scope to get reports by status.
     */
    public function scopeByStatus($query, $status)
    {
        return $query->where('report_status', $status);
    }

    /**
     * Scope to get vision-affected reports.
     */
    public function scopeVisionAffected($query)
    {
        return $query->whereIn('condition_status', ['vision_affected', 'urgent']);
    }

    /**
     * Scope to get reports by branch.
     */
    public function scopeByBranch($query, $branchId)
    {
        return $query->where('branch_id', $branchId);
    }
}
