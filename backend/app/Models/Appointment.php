<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Appointment extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'patient_id',
        'optometrist_id',
        'branch_id',
        'appointment_date',
        'start_time',
        'end_time',
        'type',
        'status',
        'notes',
        'transaction_id',
    ];

    protected $casts = [
        'appointment_date' => 'date',
        // Columns are stored as TIME in DB; cast to string to avoid datetime parsing errors
        'start_time' => 'string',
        'end_time' => 'string',
    ];

    /**
     * Get has_receipt attribute
     */
    public function getHasReceiptAttribute(): bool
    {
        if ($this->relationLoaded('receipt')) {
            return !is_null($this->receipt);
        }
        // Check if receipt exists without eager loading
        return Receipt::where('appointment_id', $this->id)->exists();
    }

    /**
     * Get receipt_id attribute
     */
    public function getReceiptIdAttribute()
    {
        if ($this->relationLoaded('receipt')) {
            return $this->receipt->id ?? null;
        }
        // Get receipt id without eager loading
        $receipt = Receipt::where('appointment_id', $this->id)->first();
        return $receipt ? $receipt->id : null;
    }

    // Relationships
    public function patient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'patient_id');
    }

    public function optometrist(): BelongsTo
    {
        return $this->belongsTo(User::class, 'optometrist_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function feedback()
    {
        return $this->hasOne(Feedback::class);
    }

    public function transaction()
    {
        return $this->belongsTo(Transaction::class);
    }

    public function receipt()
    {
        return $this->hasOne(Receipt::class);
    }

    // Scopes
    public function scopeForPatient($query, $patientId)
    {
        return $query->where('patient_id', $patientId);
    }

    public function scopeForOptometrist($query, $optometristId)
    {
        return $query->where('optometrist_id', $optometristId);
    }

    public function scopeByStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    public function scopeUpcoming($query)
    {
        return $query->where('appointment_date', '>=', now()->toDateString())
                    ->where('start_time', '>=', now());
    }

    public function scopeToday($query)
    {
        return $query->where('appointment_date', now()->toDateString());
    }
}
