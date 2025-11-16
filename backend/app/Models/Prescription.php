<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Carbon\Carbon;
use App\Traits\Auditable;

class Prescription extends Model
{
    use SoftDeletes, Auditable;

    protected $fillable = [
        'appointment_id',
        'patient_id',
        'optometrist_id',
        'branch_id',
        'type',
        'prescription_number',
        'prescription_data',
        'right_eye',
        'left_eye',
        'vision_acuity',
        'additional_notes',
        'recommendations',
        'lens_type',
        'coating',
        'follow_up_date',
        'follow_up_notes',
        'issue_date',
        'expiry_date',
        'status',
        'notes',
    ];

    protected $casts = [
        'prescription_data' => 'array',
        'right_eye' => 'array',
        'left_eye' => 'array',
        'issue_date' => 'date',
        'expiry_date' => 'date',
        'follow_up_date' => 'date',
    ];

    /**
     * Get the appointment that owns the prescription.
     */
    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }

    /**
     * Get the patient that owns the prescription.
     */
    public function patient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'patient_id');
    }

    /**
     * Get the optometrist that created the prescription.
     */
    public function optometrist(): BelongsTo
    {
        return $this->belongsTo(User::class, 'optometrist_id');
    }

    // Removed accessors - Laravel's array cast handles JSON encoding/decoding automatically
    // Accessors were interfering with the casting mechanism
    // If prescription_data fallback is needed, handle it in the resource or controller

    /**
     * Accessor for vision_acuity - returns data from prescription_data if not set directly
     */
    public function getVisionAcuityAttribute($value)
    {
        if ($value) {
            return $value;
        }
        
        $data = $this->prescription_data ?? [];
        return $data['vision_acuity'] ?? null;
    }

    /**
     * Accessor for lens_type - returns data from prescription_data if not set directly
     */
    public function getLensTypeAttribute($value)
    {
        if ($value) {
            return $value;
        }
        
        $data = $this->prescription_data ?? [];
        return $data['lens_type'] ?? null;
    }

    /**
     * Accessor for coating - returns data from prescription_data if not set directly
     */
    public function getCoatingAttribute($value)
    {
        if ($value) {
            return $value;
        }
        
        $data = $this->prescription_data ?? [];
        return $data['coating'] ?? null;
    }

    /**
     * Accessor for recommendations - returns data from prescription_data if not set directly
     */
    public function getRecommendationsAttribute($value)
    {
        if ($value) {
            return $value;
        }
        
        $data = $this->prescription_data ?? [];
        return $data['recommendations'] ?? null;
    }

    /**
     * Accessor for additional_notes - returns data from prescription_data if not set directly
     */
    public function getAdditionalNotesAttribute($value)
    {
        if ($value) {
            return $value;
        }
        
        $data = $this->prescription_data ?? [];
        return $data['additional_notes'] ?? null;
    }

    /**
     * Accessor for follow_up_date - returns data from prescription_data if not set directly
     */
    public function getFollowUpDateAttribute($value)
    {
        if ($value) {
            return $value;
        }
        
        $data = $this->prescription_data ?? [];
        return isset($data['follow_up_date']) ? $data['follow_up_date'] : null;
    }

    /**
     * Accessor for follow_up_notes - returns data from prescription_data if not set directly
     */
    public function getFollowUpNotesAttribute($value)
    {
        if ($value) {
            return $value;
        }
        
        $data = $this->prescription_data ?? [];
        return $data['follow_up_notes'] ?? null;
    }

    /**
     * Get the branch where the prescription was created.
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * Check if prescription is expired.
     */
    public function isExpired(): bool
    {
        return $this->expiry_date < now();
    }

    /**
     * Check if prescription is active.
     */
    public function isActive(): bool
    {
        return $this->status === 'active' && !$this->isExpired();
    }

    /**
     * Get formatted prescription number.
     */
    public function getFormattedNumberAttribute(): string
    {
        return 'RX-' . str_pad($this->id, 6, '0', STR_PAD_LEFT);
    }

    /**
     * Generate prescription number.
     */
    public static function generatePrescriptionNumber(): string
    {
        $lastPrescription = self::orderBy('id', 'desc')->first();
        $nextId = $lastPrescription ? $lastPrescription->id + 1 : 1;
        return 'RX-' . str_pad($nextId, 6, '0', STR_PAD_LEFT);
    }

    /**
     * Scope for active prescriptions.
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active')
                    ->where('expiry_date', '>=', now());
    }

    /**
     * Scope for expired prescriptions.
     */
    public function scopeExpired($query)
    {
        return $query->where('expiry_date', '<', now());
    }

    /**
     * Scope for prescriptions by patient.
     */
    public function scopeForPatient($query, int $patientId)
    {
        return $query->where('patient_id', $patientId);
    }

    /**
     * Scope for prescriptions by optometrist.
     */
    public function scopeByOptometrist($query, int $optometristId)
    {
        return $query->where('optometrist_id', $optometristId);
    }
}
