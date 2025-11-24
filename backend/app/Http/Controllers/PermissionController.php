<?php

namespace App\Http\Controllers;

use App\Models\Permission;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class PermissionController extends Controller
{
    /**
     * Get all permissions
     */
    public function index(Request $request): JsonResponse
    {
        $query = Permission::query();

        if ($request->has('module')) {
            $query->where('module', $request->module);
        }

        $permissions = $query->orderBy('module')->orderBy('name')->get();

        return response()->json([
            'data' => $permissions
        ]);
    }

    /**
     * Get a specific permission
     */
    public function show(Permission $permission): JsonResponse
    {
        $permission->load('roles');

        return response()->json([
            'data' => $permission
        ]);
    }

    /**
     * Create a new permission
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:permissions,slug',
            'module' => 'nullable|string|max:255',
            'description' => 'nullable|string',
        ]);

        $permission = Permission::create($validated);

        return response()->json([
            'message' => 'Permission created successfully',
            'data' => $permission
        ], 201);
    }

    /**
     * Update a permission
     */
    public function update(Request $request, Permission $permission): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'slug' => 'sometimes|required|string|max:255|unique:permissions,slug,' . $permission->id,
            'module' => 'nullable|string|max:255',
            'description' => 'nullable|string',
        ]);

        $permission->update($validated);

        return response()->json([
            'message' => 'Permission updated successfully',
            'data' => $permission
        ]);
    }

    /**
     * Delete a permission
     */
    public function destroy(Permission $permission): JsonResponse
    {
        $permission->delete();

        return response()->json([
            'message' => 'Permission deleted successfully'
        ]);
    }
}

