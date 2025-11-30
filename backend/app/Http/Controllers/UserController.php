<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class UserController extends Controller
{
    /**
     * Assign roles to a user
     */
    public function assignRoles(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'role_ids' => 'required|array',
            'role_ids.*' => 'exists:roles,id',
        ]);

        $user->roles()->sync($validated['role_ids']);

        return response()->json([
            'message' => 'Roles assigned successfully',
            'data' => $user->load('roles')
        ]);
    }

    /**
     * Remove roles from a user
     */
    public function removeRoles(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'role_ids' => 'required|array',
            'role_ids.*' => 'exists:roles,id',
        ]);

        $user->roles()->detach($validated['role_ids']);

        return response()->json([
            'message' => 'Roles removed successfully',
            'data' => $user->load('roles')
        ]);
    }

    /**
     * Get all roles assigned to a user
     */
    public function getUserRoles(User $user): JsonResponse
    {
        $roles = $user->roles()->with('permissions')->get();

        return response()->json([
            'data' => $roles
        ]);
    }

    /**
     * Get all permissions for a user (through their roles)
     */
    public function getUserPermissions(User $user): JsonResponse
    {
        $permissions = $user->roles()
            ->with('permissions')
            ->get()
            ->pluck('permissions')
            ->flatten()
            ->unique('id')
            ->values();

        return response()->json([
            'data' => $permissions
        ]);
    }
}

