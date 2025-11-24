<?php

namespace App\Http\Controllers;

use App\Models\LensType;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class LensTypeController extends Controller
{
    /**
     * Get all lens types
     */
    public function index(Request $request): JsonResponse
    {
        $query = LensType::query();

        if ($request->has('category')) {
            $query->where('category', $request->category);
        }

        if ($request->has('active_only') && $request->active_only) {
            $query->active();
        }

        $lensTypes = $query->ordered()->get();

        return response()->json([
            'data' => $lensTypes
        ]);
    }

    /**
     * Get a specific lens type
     */
    public function show(LensType $lensType): JsonResponse
    {
        return response()->json([
            'data' => $lensType
        ]);
    }

    /**
     * Create a new lens type
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:lens_types,slug',
            'description' => 'nullable|string',
            'category' => 'nullable|string|max:255',
            'base_price' => 'required|numeric|min:0',
            'specifications' => 'nullable|array',
            'is_active' => 'sometimes|boolean',
            'sort_order' => 'sometimes|integer',
        ]);

        $lensType = LensType::create($validated);

        return response()->json([
            'message' => 'Lens type created successfully',
            'data' => $lensType
        ], 201);
    }

    /**
     * Update a lens type
     */
    public function update(Request $request, LensType $lensType): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'slug' => 'sometimes|required|string|max:255|unique:lens_types,slug,' . $lensType->id,
            'description' => 'nullable|string',
            'category' => 'nullable|string|max:255',
            'base_price' => 'sometimes|numeric|min:0',
            'specifications' => 'nullable|array',
            'is_active' => 'sometimes|boolean',
            'sort_order' => 'sometimes|integer',
        ]);

        $lensType->update($validated);

        return response()->json([
            'message' => 'Lens type updated successfully',
            'data' => $lensType
        ]);
    }

    /**
     * Delete a lens type
     */
    public function destroy(LensType $lensType): JsonResponse
    {
        $lensType->delete();

        return response()->json([
            'message' => 'Lens type deleted successfully'
        ]);
    }
}

