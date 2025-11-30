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
        'sex',
        'emergency_contact',
        'emergency_phone',
        'must_change_password',
        'privacy_policy_accepted_at',
        'privacy_policy_version',
        'terms_accepted_at',
        'terms_version',
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
            'privacy_policy_accepted_at' => 'datetime',
            'terms_accepted_at' => 'datetime',
            'date_of_birth' => 'date',
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

    /**
     * Get roles assigned to this user (many-to-many)
     */
    public function roles()
    {
        return $this->belongsToMany(Role::class, 'user_roles')
                    ->withTimestamps();
    }

    /**
     * Get user groups this user belongs to
     */
    public function userGroups()
    {
        return $this->belongsToMany(UserGroup::class, 'user_group_members')
                    ->withTimestamps();
    }

    /**
     * Check if user has a specific role
     */
    public function hasRole(string $roleSlug): bool
    {
        return $this->roles()->where('slug', $roleSlug)->exists();
    }

    /**
     * Check if user has a specific permission
     */
    public function hasPermission(string $permissionSlug): bool
    {
        return $this->roles()->whereHas('permissions', function ($query) use ($permissionSlug) {
            $query->where('slug', $permissionSlug);
        })->exists();
    }

    /**
     * Check if user belongs to a specific group
     */
    public function belongsToGroup(string $groupName): bool
    {
        return $this->userGroups()->where('name', $groupName)->exists();
    }

    /**
     * Check if user has accepted the latest privacy policy
     */
    public function hasAcceptedLatestPrivacyPolicy(): bool
    {
        $latestPolicy = Policy::getLatest('privacy_policy');
        
        if (!$latestPolicy) {
            return false;
        }

        return $this->privacy_policy_version === $latestPolicy->version 
            && $this->privacy_policy_accepted_at !== null;
    }

    /**
     * Check if user has accepted the latest terms and conditions
     */
    public function hasAcceptedLatestTerms(): bool
    {
        $latestTerms = Policy::getLatest('terms_conditions');
        
        if (!$latestTerms) {
            return false;
        }

        return $this->terms_version === $latestTerms->version 
            && $this->terms_accepted_at !== null;
    }

    /**
     * Accept privacy policy
     */
    public function acceptPrivacyPolicy(string $version): void
    {
        $this->update([
            'privacy_policy_accepted_at' => now(),
            'privacy_policy_version' => $version,
        ]);
    }

    /**
     * Accept terms and conditions
     */
    public function acceptTerms(string $version): void
    {
        $this->update([
            'terms_accepted_at' => now(),
            'terms_version' => $version,
        ]);
    }
}
