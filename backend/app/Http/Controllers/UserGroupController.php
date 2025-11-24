<?php

namespace App\Http\Controllers;

use App\Models\UserGroup;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class UserGroupController extends Controller
{
    /**
     * Get all user groups
     */
    public function index(): JsonResponse
    {
        $groups = UserGroup::with('users')->orderBy('name')->get();

        return response()->json([
            'data' => $groups
        ]);
    }

    /**
     * Get a specific user group
     */
    public function show(UserGroup $userGroup): JsonResponse
    {
        $userGroup->load('users');

        return response()->json([
            'data' => $userGroup
        ]);
    }

    /**
     * Create a new user group
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'is_active' => 'sometimes|boolean',
        ]);

        $group = UserGroup::create($validated);

        return response()->json([
            'message' => 'User group created successfully',
            'data' => $group
        ], 201);
    }

    /**
     * Update a user group
     */
    public function update(Request $request, UserGroup $userGroup): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'is_active' => 'sometimes|boolean',
        ]);

        $userGroup->update($validated);

        return response()->json([
            'message' => 'User group updated successfully',
            'data' => $userGroup
        ]);
    }

    /**
     * Delete a user group
     */
    public function destroy(UserGroup $userGroup): JsonResponse
    {
        $userGroup->delete();

        return response()->json([
            'message' => 'User group deleted successfully'
        ]);
    }

    /**
     * Add users to group
     */
    public function addUsers(Request $request, UserGroup $userGroup): JsonResponse
    {
        $validated = $request->validate([
            'user_ids' => 'required|array',
            'user_ids.*' => 'exists:users,id',
        ]);

        $userGroup->users()->syncWithoutDetaching($validated['user_ids']);

        return response()->json([
            'message' => 'Users added to group successfully',
            'data' => $userGroup->load('users')
        ]);
    }

    /**
     * Remove users from group
     */
    public function removeUsers(Request $request, UserGroup $userGroup): JsonResponse
    {
        $validated = $request->validate([
            'user_ids' => 'required|array',
            'user_ids.*' => 'exists:users,id',
        ]);

        $userGroup->users()->detach($validated['user_ids']);

        return response()->json([
            'message' => 'Users removed from group successfully',
            'data' => $userGroup->load('users')
        ]);
    }
}

