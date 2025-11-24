<?php

namespace App\Http\Controllers;

use App\Models\DiscountPackage;
use App\Models\DiscountPackageUsage;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class DiscountPackageController extends Controller
{
    /**
     * Get all discount packages
     */
    public function index(Request $request): JsonResponse
    {
        $query = DiscountPackage::query();

        if ($request->has('active_only') && $request->active_only) {
            $query->active();
        }

        if ($request->has('valid_only') && $request->valid_only) {
            $query->valid();
        }

        $packages = $query->orderBy('name')->get();

        return response()->json([
            'data' => $packages
        ]);
    }

    /**
     * Get a specific discount package
     */
    public function show(DiscountPackage $discountPackage): JsonResponse
    {
        $discountPackage->load('usages');

        return response()->json([
            'data' => $discountPackage
        ]);
    }

    /**
     * Create a new discount package
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'nullable|string|max:255|unique:discount_packages,code',
            'description' => 'nullable|string',
            'discount_type' => 'required|in:percentage,fixed_amount',
            'discount_value' => 'required|numeric|min:0',
            'minimum_purchase' => 'nullable|numeric|min:0',
            'maximum_discount' => 'nullable|numeric|min:0',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'usage_limit' => 'nullable|integer|min:1',
            'usage_limit_per_user' => 'nullable|integer|min:1',
            'is_active' => 'sometimes|boolean',
            'applicable_categories' => 'nullable|array',
            'applicable_products' => 'nullable|array',
        ]);

        $package = DiscountPackage::create($validated);

        return response()->json([
            'message' => 'Discount package created successfully',
            'data' => $package
        ], 201);
    }

    /**
     * Update a discount package
     */
    public function update(Request $request, DiscountPackage $discountPackage): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'code' => 'sometimes|nullable|string|max:255|unique:discount_packages,code,' . $discountPackage->id,
            'description' => 'nullable|string',
            'discount_type' => 'sometimes|required|in:percentage,fixed_amount',
            'discount_value' => 'sometimes|required|numeric|min:0',
            'minimum_purchase' => 'nullable|numeric|min:0',
            'maximum_discount' => 'nullable|numeric|min:0',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'usage_limit' => 'nullable|integer|min:1',
            'usage_limit_per_user' => 'nullable|integer|min:1',
            'is_active' => 'sometimes|boolean',
            'applicable_categories' => 'nullable|array',
            'applicable_products' => 'nullable|array',
        ]);

        $discountPackage->update($validated);

        return response()->json([
            'message' => 'Discount package updated successfully',
            'data' => $discountPackage
        ]);
    }

    /**
     * Delete a discount package
     */
    public function destroy(DiscountPackage $discountPackage): JsonResponse
    {
        $discountPackage->delete();

        return response()->json([
            'message' => 'Discount package deleted successfully'
        ]);
    }

    /**
     * Validate and calculate discount
     */
    public function validateDiscount(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'required|string',
            'purchase_amount' => 'required|numeric|min:0',
            'user_id' => 'nullable|exists:users,id',
        ]);

        $package = DiscountPackage::where('code', $validated['code'])->first();

        if (!$package) {
            return response()->json([
                'valid' => false,
                'message' => 'Discount code not found'
            ], 404);
        }

        $userId = $validated['user_id'] ?? Auth::id();

        if (!$package->isValid()) {
            return response()->json([
                'valid' => false,
                'message' => 'Discount code is not currently valid'
            ]);
        }

        if ($userId && !$package->canBeUsedBy($userId)) {
            return response()->json([
                'valid' => false,
                'message' => 'You have reached the usage limit for this discount'
            ]);
        }

        $discountAmount = $package->calculateDiscount($validated['purchase_amount']);

        return response()->json([
            'valid' => true,
            'discount_amount' => $discountAmount,
            'final_amount' => $validated['purchase_amount'] - $discountAmount,
            'package' => $package
        ]);
    }

    /**
     * Record discount usage
     */
    public function recordUsage(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'discount_package_id' => 'required|exists:discount_packages,id',
            'user_id' => 'required|exists:users,id',
            'transaction_id' => 'nullable|exists:transactions,id',
            'discount_amount' => 'required|numeric|min:0',
        ]);

        $usage = DiscountPackageUsage::create($validated);

        return response()->json([
            'message' => 'Discount usage recorded',
            'data' => $usage
        ], 201);
    }
}

