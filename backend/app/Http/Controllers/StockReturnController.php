<?php

namespace App\Http\Controllers;

use App\Models\StockReturn;
use App\Models\Product;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\InventoryTransaction;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class StockReturnController extends Controller
{
    /**
     * Display a listing of stock returns.
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $query = StockReturn::with(['product', 'branch', 'approver', 'creator']);

            // Handle role format
            $userRole = null;
            if (is_object($user->role)) {
                $userRole = $user->role->value ?? (string)$user->role;
            } else {
                $userRole = (string)$user->role;
            }

            // Filter by branch for staff (they can only see their branch's returns)
            if ($userRole === 'staff') {
                if (!$user->branch_id) {
                    return response()->json(['message' => 'Staff user has no branch assigned'], 400);
                }
                $query->where('branch_id', $user->branch_id);
            }

            // Filter by status if provided
            if ($request->has('status')) {
                $query->where('status', $request->status);
            }

            // Filter by return type if provided
            if ($request->has('return_type')) {
                $query->where('return_type', $request->return_type);
            }

            // Filter by branch if admin provides it
            if ($userRole === 'admin' && $request->has('branch_id')) {
                $query->where('branch_id', $request->branch_id);
            }

            $stockReturns = $query->orderBy('created_at', 'desc')->paginate(20);

            return response()->json([
                'data' => $stockReturns->items(),
                'pagination' => [
                    'current_page' => $stockReturns->currentPage(),
                    'last_page' => $stockReturns->lastPage(),
                    'per_page' => $stockReturns->perPage(),
                    'total' => $stockReturns->total(),
                ]
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in StockReturnController@index: ' . $e->getMessage());
            return response()->json([
                'message' => 'An error occurred while fetching stock returns',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Store a newly created stock return.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'product_id' => 'required|exists:products,id',
            'branch_id' => 'required|exists:branches,id',
            'return_type' => 'required|in:defective,damaged,expired,other',
            'quantity' => 'required|integer|min:1',
            'unit_cost' => 'nullable|numeric|min:0',
            'reason' => 'required|string|max:1000',
            'return_reference' => 'nullable|string|max:255',
            'product_condition' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = Auth::user();

        // Get user role
        $userRole = null;
        if (is_object($user->role)) {
            $userRole = $user->role->value ?? (string)$user->role;
        } else {
            $userRole = (string)$user->role;
        }

        // Staff can only create returns for their branch
        if ($userRole === 'staff' && $user->branch_id != $request->branch_id) {
            return response()->json(['message' => 'Unauthorized to create returns for this branch'], 403);
        }

        // Check if product exists and get current stock
        $product = Product::findOrFail($request->product_id);
        $branch = Branch::findOrFail($request->branch_id);

        // Verify there's enough stock to return (should be the case, but double-check)
        // Note: This would need to be checked against the actual inventory system

        try {
            $stockReturn = StockReturn::create([
                'product_id' => $request->product_id,
                'branch_id' => $request->branch_id,
                'return_type' => $request->return_type,
                'quantity' => $request->quantity,
                'unit_cost' => $request->unit_cost,
                'reason' => $request->reason,
                'return_reference' => $request->return_reference,
                'status' => 'pending',
                'product_condition' => $request->product_condition,
                'created_by' => $user->id,
            ]);

            $stockReturn->load(['product', 'branch', 'creator']);

            return response()->json([
                'message' => 'Stock return request created successfully',
                'data' => [
                    'id' => $stockReturn->id,
                    'status' => $stockReturn->status,
                    'created_at' => $stockReturn->created_at,
                ]
            ], 201);
        } catch (\Exception $e) {
            \Log::error('Error creating stock return: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to create stock return request',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified stock return.
     */
    public function show($id): JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $stockReturn = StockReturn::with(['product', 'branch', 'approver', 'creator'])
                ->findOrFail($id);

            // Get user role
            $userRole = null;
            if (is_object($user->role)) {
                $userRole = $user->role->value ?? (string)$user->role;
            } else {
                $userRole = (string)$user->role;
            }

            // Staff can only see returns from their branch
            if ($userRole === 'staff' && $stockReturn->branch_id != $user->branch_id) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            return response()->json([
                'data' => [
                    'id' => $stockReturn->id,
                    'product' => $stockReturn->product ? [
                        'id' => $stockReturn->product->id,
                        'name' => $stockReturn->product->name,
                        'sku' => $stockReturn->product->sku,
                        'category' => $stockReturn->product->category,
                    ] : null,
                    'branch' => $stockReturn->branch ? [
                        'id' => $stockReturn->branch->id,
                        'name' => $stockReturn->branch->name,
                    ] : null,
                    'return_type' => $stockReturn->return_type,
                    'quantity' => $stockReturn->quantity,
                    'unit_cost' => $stockReturn->unit_cost,
                    'total_cost' => $stockReturn->total_cost,
                    'reason' => $stockReturn->reason,
                    'return_reference' => $stockReturn->return_reference,
                    'status' => $stockReturn->status,
                    'product_condition' => $stockReturn->product_condition,
                    'admin_notes' => $stockReturn->admin_notes,
                    'approver' => $stockReturn->approver ? [
                        'id' => $stockReturn->approver->id,
                        'name' => $stockReturn->approver->name,
                    ] : null,
                    'approved_at' => $stockReturn->approved_at,
                    'creator' => $stockReturn->creator ? [
                        'id' => $stockReturn->creator->id,
                        'name' => $stockReturn->creator->name,
                    ] : null,
                    'created_at' => $stockReturn->created_at,
                    'updated_at' => $stockReturn->updated_at,
                ]
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in StockReturnController@show: ' . $e->getMessage());
            return response()->json([
                'message' => 'Stock return not found',
                'error' => $e->getMessage()
            ], 404);
        }
    }

    /**
     * Update the specified stock return.
     */
    public function update(Request $request, $id): JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $stockReturn = StockReturn::findOrFail($id);

            // Get user role
            $userRole = null;
            if (is_object($user->role)) {
                $userRole = $user->role->value ?? (string)$user->role;
            } else {
                $userRole = (string)$user->role;
            }

            // Staff can only update returns from their branch
            if ($userRole === 'staff' && $stockReturn->branch_id != $user->branch_id) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Only allow certain fields to be updated
            $validator = Validator::make($request->all(), [
                'return_type' => 'sometimes|in:defective,damaged,expired,other',
                'quantity' => 'sometimes|integer|min:1',
                'unit_cost' => 'sometimes|numeric|min:0',
                'reason' => 'sometimes|string|max:1000',
                'return_reference' => 'sometimes|string|max:255',
                'product_condition' => 'sometimes|array',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Only creator can update pending returns
            if ($stockReturn->status !== 'pending' || $stockReturn->created_by !== $user->id) {
                return response()->json(['message' => 'Only the creator can update pending returns'], 403);
            }

            $stockReturn->update($request->only([
                'return_type', 'quantity', 'unit_cost', 'reason', 'return_reference', 'product_condition'
            ]));

            $stockReturn->load(['product', 'branch', 'creator']);

            return response()->json([
                'message' => 'Stock return updated successfully',
                'data' => [
                    'id' => $stockReturn->id,
                    'status' => $stockReturn->status,
                    'updated_at' => $stockReturn->updated_at,
                ]
            ]);
        } catch (\Exception $e) {
            \Log::error('Error updating stock return: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to update stock return',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Approve a stock return request (Admin only).
     */
    public function approve(Request $request, $id): JsonResponse
    {
        try {
            $user = Auth::user();

            // Get user role
            $userRole = null;
            if (is_object($user->role)) {
                $userRole = $user->role->value ?? (string)$user->role;
            } else {
                $userRole = (string)$user->role;
            }

            if ($userRole !== 'admin') {
                return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
            }

            $stockReturn = StockReturn::findOrFail($id);

            if ($stockReturn->status !== 'pending') {
                return response()->json(['message' => 'Return request has already been processed'], 422);
            }

            $validator = Validator::make($request->all(), [
                'admin_notes' => 'nullable|string|max:1000',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            DB::transaction(function () use ($stockReturn, $user, $request, $userRole) {
                $stockReturn->update([
                    'status' => 'approved',
                    'approved_by' => $user->id,
                    'approved_at' => now(),
                    'admin_notes' => $request->admin_notes,
                ]);

                // Find or create branch stock record for this product/branch
                $branchStock = BranchStock::firstOrCreate(
                    [
                        'product_id' => $stockReturn->product_id,
                        'branch_id' => $stockReturn->branch_id,
                    ],
                    [
                        'stock_quantity' => 0,
                        'reserved_quantity' => 0,
                    ]
                );

                $oldQuantity = (int) $branchStock->stock_quantity;

                // Never allow stock to go negative
                $returnQuantity = min((int) $stockReturn->quantity, max(0, $oldQuantity));
                $newQuantity = max(0, $oldQuantity - $returnQuantity);

                // Update branch stock quantity
                $branchStock->update([
                    'stock_quantity' => $newQuantity,
                ]);

                // Create inventory transaction record for audit trail
                $costPerUnit = $stockReturn->unit_cost ?? $branchStock->cost_per_unit ?? 0;

                InventoryTransaction::create([
                    'product_id' => $stockReturn->product_id,
                    'branch_id' => $stockReturn->branch_id,
                    'branch_stock_id' => $branchStock->id,
                    'transaction_type' => 'return',
                    'quantity_change' => -$returnQuantity,
                    'previous_quantity' => $oldQuantity,
                    'new_quantity' => $newQuantity,
                    'reference_type' => StockReturn::class,
                    'reference_id' => $stockReturn->id,
                    'adjustment_reason' => $stockReturn->return_type,
                    'notes' => $request->admin_notes,
                    'reason' => $stockReturn->reason,
                    'performed_by' => $user->id,
                    'performed_by_role' => $userRole,
                    'cost_per_unit' => $costPerUnit,
                    'total_cost' => $costPerUnit * $returnQuantity,
                ]);

                // Sync product's total stock quantity across branches
                $totalStock = BranchStock::where('product_id', $stockReturn->product_id)->sum('stock_quantity');
                Product::where('id', $stockReturn->product_id)->update(['stock_quantity' => $totalStock]);

                // Clear relevant inventory cache so dashboards use fresh data
                $branchId = $stockReturn->branch_id;
                if ($branchId) {
                    Cache::forget('realtime_inventory_' . md5(serialize(['branch_id' => $branchId])));
                    Cache::forget('enhanced_inventory_branch_' . $branchId);
                }
                Cache::forget('enhanced_inventory_all');
            });

            return response()->json([
                'message' => 'Stock return request approved successfully'
            ]);
        } catch (\Exception $e) {
            \Log::error('Error approving stock return: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to approve stock return',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Reject a stock return request (Admin only).
     */
    public function reject(Request $request, $id): JsonResponse
    {
        try {
            $user = Auth::user();

            // Get user role
            $userRole = null;
            if (is_object($user->role)) {
                $userRole = $user->role->value ?? (string)$user->role;
            } else {
                $userRole = (string)$user->role;
            }

            if ($userRole !== 'admin') {
                return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
            }

            $stockReturn = StockReturn::findOrFail($id);

            if ($stockReturn->status !== 'pending') {
                return response()->json(['message' => 'Return request has already been processed'], 422);
            }

            $validator = Validator::make($request->all(), [
                'admin_notes' => 'required|string|max:1000',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $stockReturn->update([
                'status' => 'rejected',
                'approved_by' => $user->id,
                'approved_at' => now(),
                'admin_notes' => $request->admin_notes,
            ]);

            return response()->json([
                'message' => 'Stock return request rejected'
            ]);
        } catch (\Exception $e) {
            \Log::error('Error rejecting stock return: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to reject stock return',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Mark a stock return as processed (Admin only).
     */
    public function markAsProcessed(Request $request, $id): JsonResponse
    {
        try {
            $user = Auth::user();

            // Get user role
            $userRole = null;
            if (is_object($user->role)) {
                $userRole = $user->role->value ?? (string)$user->role;
            } else {
                $userRole = (string)$user->role;
            }

            if ($userRole !== 'admin') {
                return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
            }

            $stockReturn = StockReturn::findOrFail($id);

            if ($stockReturn->status !== 'approved') {
                return response()->json(['message' => 'Return request must be approved before processing'], 422);
            }

            $stockReturn->update([
                'status' => 'processed',
            ]);

            // TODO: Here you would typically complete the return process
            // including any logistics coordination with suppliers/manufacturers

            return response()->json([
                'message' => 'Stock return marked as processed successfully'
            ]);
        } catch (\Exception $e) {
            \Log::error('Error processing stock return: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to process stock return',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove the specified stock return.
     */
    public function destroy($id): JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $stockReturn = StockReturn::findOrFail($id);

            // Get user role
            $userRole = null;
            if (is_object($user->role)) {
                $userRole = $user->role->value ?? (string)$user->role;
            } else {
                $userRole = (string)$user->role;
            }

            // Staff can only delete returns from their branch
            if ($userRole === 'staff' && $stockReturn->branch_id != $user->branch_id) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Only creators can delete their own returns, and only if they're pending
            if ($stockReturn->created_by !== $user->id || $stockReturn->status !== 'pending') {
                if ($userRole !== 'admin') {
                    return response()->json(['message' => 'Only creators can delete pending returns they created'], 403);
                }
            }

            $stockReturn->delete(); // Soft delete

            return response()->json([
                'message' => 'Stock return deleted successfully (soft deleted - data preserved in database)'
            ]);
        } catch (\Exception $e) {
            \Log::error('Error deleting stock return: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to delete stock return',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
