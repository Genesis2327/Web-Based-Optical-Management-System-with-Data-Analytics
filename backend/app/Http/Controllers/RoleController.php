<?php

namespace App\Http\Controllers;

use App\Models\Role;
use App\Models\Permission;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class RoleController extends Controller
{
    /**
     * Get all roles
     */
    public function index(): JsonResponse
    {
        $roles = Role::with('permissions')->orderBy('name')->get();
        
        return response()->json([
            'data' => $roles
        ]);
    }

    /**
     * Get a specific role
     */
    public function show(Role $role): JsonResponse
    {
        $role->load(['permissions', 'users']);
        
        return response()->json([
            'data' => $role
        ]);
    }

    /**
     * Create a new role
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:roles,slug',
            'description' => 'nullable|string',
            'permissions' => 'nullable|array',
            'permissions.*' => 'exists:permissions,id',
        ]);

        $role = Role::create([
            'name' => $validated['name'],
            'slug' => $validated['slug'],
            'description' => $validated['description'] ?? null,
        ]);

        if (isset($validated['permissions'])) {
            $role->permissions()->attach($validated['permissions']);
        }

        $role->load('permissions');

        return response()->json([
            'message' => 'Role created successfully',
            'data' => $role
        ], 201);
    }

    /**
     * Update a role
     */
    public function update(Request $request, Role $role): JsonResponse
    {
        if ($role->is_system) {
            return response()->json([
                'message' => 'System roles cannot be modified'
            ], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'slug' => 'sometimes|required|string|max:255|unique:roles,slug,' . $role->id,
            'description' => 'nullable|string',
            'is_active' => 'sometimes|boolean',
            'permissions' => 'nullable|array',
            'permissions.*' => 'exists:permissions,id',
        ]);

        $role->update($validated);

        if (isset($validated['permissions'])) {
            $role->permissions()->sync($validated['permissions']);
        }

        $role->load('permissions');

        return response()->json([
            'message' => 'Role updated successfully',
            'data' => $role
        ]);
    }

    /**
     * Delete a role
     */
    public function destroy(Role $role): JsonResponse
    {
        if ($role->is_system) {
            return response()->json([
                'message' => 'System roles cannot be deleted'
            ], 403);
        }

        $role->delete();

        return response()->json([
            'message' => 'Role deleted successfully'
        ]);
    }

    /**
     * Assign permissions to role
     */
    public function assignPermissions(Request $request, Role $role): JsonResponse
    {
        $validated = $request->validate([
            'permissions' => 'required|array',
            'permissions.*' => 'exists:permissions,id',
        ]);

        $role->permissions()->sync($validated['permissions']);

        return response()->json([
            'message' => 'Permissions assigned successfully',
            'data' => $role->load('permissions')
        ]);
    }
}

