<?php

namespace App\Policies;

use App\Models\Prescription;
use App\Models\User;
use App\Enums\UserRole;

/**
 * Policy to protect Prescription data
 * Ensures only authorized users can view/modify prescriptions
 */
class PrescriptionPolicy
{
    /**
     * Determine if user can view any prescriptions
     */
    public function viewAny(User $user): bool
    {
        // Admin, optometrists, and customers can view prescriptions
        // (customers will be filtered to see only their own in the controller)
        return in_array($user->role->value, [
            UserRole::ADMIN->value,
            UserRole::OPTOMETRIST->value,
            UserRole::CUSTOMER->value,
        ]);
    }

    /**
     * Determine if user can view a specific prescription
     */
    public function view(User $user, Prescription $prescription): bool
    {
        // Admin can view any prescription
        if ($user->role->value === UserRole::ADMIN->value) {
            return true;
        }

        // Optometrist who created it can view
        if ($user->role->value === UserRole::OPTOMETRIST->value && $prescription->optometrist_id === $user->id) {
            return true;
        }

        // Patient can view their own prescription
        if ($user->role->value === UserRole::CUSTOMER->value && $prescription->patient_id === $user->id) {
            return true;
        }

        return false;
    }

    /**
     * Determine if user can create prescriptions
     */
    public function create(User $user): bool
    {
        // Only optometrists can create prescriptions
        return $user->role->value === UserRole::OPTOMETRIST->value;
    }

    /**
     * Determine if user can update a prescription
     */
    public function update(User $user, Prescription $prescription): bool
    {
        // Only the optometrist who created it or admin can update
        if ($user->role->value === UserRole::ADMIN->value) {
            return true;
        }

        return $user->role->value === UserRole::OPTOMETRIST->value 
            && $prescription->optometrist_id === $user->id;
    }

    /**
     * Determine if user can delete a prescription
     */
    public function delete(User $user, Prescription $prescription): bool
    {
        // Only admin can delete prescriptions (soft delete recommended)
        return $user->role->value === UserRole::ADMIN->value;
    }
}


