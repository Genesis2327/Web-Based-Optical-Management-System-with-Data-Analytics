<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Carbon\Carbon;

class EyewearReminder extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'product_id',
        'reservation_id',
        'transaction_id',
        'product_type',
        'reminder_type',
        'reminder_interval_days',
        'last_reminder_sent',
        'next_reminder_date',
        'purchase_date',
        'last_condition_check',
        'contact_lens_expiry',
        'contact_lens_cycle_days',
        'last_replacement_date',
        'is_active',
        'is_dismissed',
        'dismissed_at',
        'notification_count',
        'last_notification_sent',
    ];

    protected $casts = [
        'last_reminder_sent' => 'datetime',
        'next_reminder_date' => 'date',
        'purchase_date' => 'date',
        'last_condition_check' => 'date',
        'contact_lens_expiry' => 'date',
        'last_replacement_date' => 'date',
        'reminder_interval_days' => 'integer',
        'contact_lens_cycle_days' => 'integer',
        'is_active' => 'boolean',
        'is_dismissed' => 'boolean',
        'dismissed_at' => 'datetime',
        'notification_count' => 'integer',
        'last_notification_sent' => 'datetime',
    ];

    /**
     * Get the user (customer) for this reminder.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the product this reminder is for.
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * Get the reservation this reminder is related to.
     */
    public function reservation(): BelongsTo
    {
        return $this->belongsTo(Reservation::class);
    }

    /**
     * Get the transaction this reminder is related to.
     */
    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    /**
     * Check if reminder is due.
     */
    public function isDue(): bool
    {
        if (!$this->is_active || $this->is_dismissed) {
            return false;
        }

        return Carbon::today()->greaterThanOrEqualTo($this->next_reminder_date);
    }

    /**
     * Calculate next reminder date based on product type.
     */
    public function calculateNextReminderDate(): Carbon
    {
        $baseDate = $this->last_condition_check ?? $this->purchase_date ?? now();
        
        // For contact lenses, use expiry or cycle
        if ($this->product_type === 'contact_lens') {
            if ($this->contact_lens_expiry) {
                // Remind 7 days before expiry
                return Carbon::parse($this->contact_lens_expiry)->subDays(7);
            } elseif ($this->contact_lens_cycle_days && $this->last_replacement_date) {
                // Remind based on replacement cycle
                return Carbon::parse($this->last_replacement_date)->addDays($this->contact_lens_cycle_days);
            }
        }
        
        // Default: use reminder interval
        return Carbon::parse($baseDate)->addDays($this->reminder_interval_days);
    }

    /**
     * Mark reminder as sent.
     */
    public function markAsSent(): void
    {
        $this->update([
            'last_reminder_sent' => now(),
            'last_notification_sent' => now(),
            'notification_count' => $this->notification_count + 1,
            'next_reminder_date' => $this->calculateNextReminderDate(),
        ]);
    }

    /**
     * Dismiss reminder.
     */
    public function dismiss(): void
    {
        $this->update([
            'is_dismissed' => true,
            'dismissed_at' => now(),
        ]);
    }

    /**
     * Scope to get active reminders.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true)
                    ->where('is_dismissed', false);
    }

    /**
     * Scope to get due reminders.
     */
    public function scopeDue($query)
    {
        return $query->active()
                    ->where('next_reminder_date', '<=', now()->toDateString());
    }
}
