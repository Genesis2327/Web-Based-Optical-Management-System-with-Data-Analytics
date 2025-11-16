<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use App\Enums\UserRole;
use App\Traits\Auditable;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, HasApiTokens, SoftDeletes, Auditable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'branch_id',
        'is_approved',
        'phone',
        'social_media',
        'address',
        'date_of_birth',
        'emergency_contact',
        'emergency_phone',
        'must_change_password',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
            'is_approved' => 'boolean',
            'must_change_password' => 'boolean',
        ];
    }

    /**
     * Get the branch this user belongs to
     */
    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * Get all branches this optometrist handles (many-to-many relationship)
     */
    public function optometristBranches()
    {
        return $this->belongsToMany(Branch::class, 'optometrist_branches')
                    ->withTimestamps();
    }

    /**
     * Check if user is an optometrist with multiple branch assignments
     */
    public function isOptometristWithMultipleBranches(): bool
    {
        return $this->role->value === 'optometrist' && $this->optometristBranches()->count() > 0;
    }

    /**
     * Check if user is assigned to a branch
     */
    public function hasBranch(): bool
    {
        return !is_null($this->branch_id);
    }

    /**
     * Get branch name for display
     */
    public function getBranchNameAttribute(): string
    {
        return $this->branch ? $this->branch->name : 'No Branch Assigned';
    }

    /**
     * Get appointments for this user (as patient)
     */
    public function appointments()
    {
        return $this->hasMany(Appointment::class, 'patient_id');
    }

    /**
     * Get prescriptions for this user (as patient)
     */
    public function prescriptions()
    {
        return $this->hasMany(Prescription::class, 'patient_id');
    }

    /**
     * Get prescriptions created by this user (as optometrist)
     */
    public function createdPrescriptions()
    {
        return $this->hasMany(Prescription::class, 'optometrist_id');
    }

    /**
     * Get transactions for this user (as customer)
     */
    public function transactions()
    {
        return $this->hasMany(Transaction::class, 'customer_id');
    }

    /**
     * Get schedules for this user (as optometrist/staff)
     */
    public function schedules()
    {
        return $this->hasMany(Schedule::class, 'staff_id');
    }
}
