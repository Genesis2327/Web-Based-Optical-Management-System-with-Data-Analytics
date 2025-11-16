<?php

namespace App\Http\Controllers;

use App\Models\RestockRequest;
use App\Models\BranchStock;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class RestockRequestController extends Controller
{
    /**
     * Display a listing of restock requests.
     */
    public function index(Request $request): JsonResponse
    {
        $user = Auth::user();
        $query = RestockRequest::with(['product', 'branch', 'requestedBy', 'approvedBy']);

        // Filter based on user role
        if ($user->role === 'staff') {
            // Staff can only see requests for their branch
            $query->where('branch_id', $user->branch_id);
        } elseif ($user->role === 'admin') {
            // Admin can see all requests
        } else {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Filter by status if provided
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $requests = $query->orderBy('created_at', 'desc')->get();

        return response()->json($requests);
    }

    /**
     * Store a newly created restock request.
     */
    public function store(Request $request): JsonResponse
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json(['error' => 'User not authenticated'], 401);
        }

        // Only staff can create restock requests
        if (!$user->role || $user->role->value !== 'staff') {
            return response()->json([
                'message' => 'Only staff can create restock requests'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'product_id' => 'required|exists:products,id',
            'requested_quantity' => 'required|integer|min:1',
            'notes' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Get current stock for the product at this branch
        $branchStock = BranchStock::where('product_id', $request->product_id)
            ->where('branch_id', $user->branch_id)
            ->first();

        if (!$branchStock) {
            return response()->json([
                'message' => 'Product not found in your branch inventory'
            ], 400);
        }

        // Check if there's already a pending request for this product
        $existingRequest = RestockRequest::where('product_id', $request->product_id)
            ->where('branch_id', $user->branch_id)
            ->where('status', 'pending')
            ->first();

        if ($existingRequest) {
            return response()->json([
                'message' => 'There is already a pending restock request for this product'
            ], 400);
        }

        $restockRequest = RestockRequest::create([
            'branch_id' => $user->branch_id,
            'product_id' => $request->product_id,
            'requested_by' => $user->id,
            'current_stock' => $branchStock->stock_quantity,
            'requested_quantity' => $request->requested_quantity,
            'notes' => $request->notes,
            'status' => 'pending',
        ]);

        return response()->json([
            'message' => 'Restock request created successfully',
            'request' => $restockRequest->load(['product', 'branch', 'requestedBy'])
        ], 201);
    }

    /**
     * Display the specified restock request.
     */
    public function show(RestockRequest $restockRequest): JsonResponse
    {
        $user = Auth::user();

        // Check if user can view this request
        if ($user->role === 'staff' && $restockRequest->branch_id !== $user->branch_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return response()->json($restockRequest->load(['product', 'branch', 'requestedBy', 'approvedBy']));
    }

    /**
     * Update the specified restock request.
     */
    public function update(Request $request, RestockRequest $restockRequest): JsonResponse
    {
        $user = Auth::user();

        // Only admin can update restock requests
        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'status' => 'required|in:pending,approved,rejected,fulfilled',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $data = $validator->validated();

        // Handle status changes
        if ($data['status'] === 'approved') {
            $data['approved_by'] = $user->id;
            $data['approved_at'] = now();
        } elseif ($data['status'] === 'fulfilled') {
            $data['fulfilled_at'] = now();
            
            // Update branch stock when request is fulfilled
            DB::transaction(function () use ($restockRequest) {
                $branchStock = BranchStock::where('product_id', $restockRequest->product_id)
                    ->where('branch_id', $restockRequest->branch_id)
                    ->first();

                if ($branchStock) {
                    $branchStock->increment('stock_quantity', $restockRequest->requested_quantity);
                }
            });
        }

        $restockRequest->update($data);

        return response()->json([
            'message' => 'Restock request updated successfully',
            'request' => $restockRequest->load(['product', 'branch', 'requestedBy', 'approvedBy'])
        ]);
    }

    /**
     * Remove the specified restock request.
     */
    public function destroy(RestockRequest $restockRequest): JsonResponse
    {
        $user = Auth::user();

        // Only the requester or admin can delete requests
        if ($user->role === 'staff' && $restockRequest->requested_by !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($user->role !== 'admin' && $user->role !== 'staff') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Only allow deletion of pending requests
        if ($restockRequest->status !== 'pending') {
            return response()->json([
                'message' => 'Only pending requests can be deleted'
            ], 400);
        }

        $restockRequest->delete();

        return response()->json([
            'message' => 'Restock request deleted successfully (soft deleted - data preserved in database)'
        ]);
    }

    /**
     * Approve a restock request (Admin only).
     */
    public function approve(RestockRequest $restockRequest): JsonResponse
    {
        $user = Auth::user();

        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($restockRequest->status !== 'pending') {
            return response()->json([
                'message' => 'Only pending requests can be approved'
            ], 400);
        }

        $restockRequest->update([
            'status' => 'approved',
            'approved_by' => $user->id,
            'approved_at' => now(),
        ]);

        return response()->json([
            'message' => 'Restock request approved successfully',
            'request' => $restockRequest->load(['product', 'branch', 'requestedBy', 'approvedBy'])
        ]);
    }

    /**
     * Reject a restock request (Admin only).
     */
    public function reject(RestockRequest $restockRequest): JsonResponse
    {
        $user = Auth::user();

        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($restockRequest->status !== 'pending') {
            return response()->json([
                'message' => 'Only pending requests can be rejected'
            ], 400);
        }

        $restockRequest->update([
            'status' => 'rejected',
            'approved_by' => $user->id,
            'approved_at' => now(),
        ]);

        return response()->json([
            'message' => 'Restock request rejected successfully',
            'request' => $restockRequest->load(['product', 'branch', 'requestedBy', 'approvedBy'])
        ]);
    }

    /**
     * Fulfill a restock request (Admin only).
     */
    public function fulfill(RestockRequest $restockRequest): JsonResponse
    {
        $user = Auth::user();

        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($restockRequest->status !== 'approved') {
            return response()->json([
                'message' => 'Only approved requests can be fulfilled'
            ], 400);
        }

        DB::transaction(function () use ($restockRequest) {
            // Update request status
            $restockRequest->update([
                'status' => 'fulfilled',
                'fulfilled_at' => now(),
            ]);

            // Update branch stock
            $branchStock = BranchStock::where('product_id', $restockRequest->product_id)
                ->where('branch_id', $restockRequest->branch_id)
                ->first();

            if ($branchStock) {
                $branchStock->increment('stock_quantity', $restockRequest->requested_quantity);
            }
        });

        return response()->json([
            'message' => 'Restock request fulfilled successfully',
            'request' => $restockRequest->load(['product', 'branch', 'requestedBy', 'approvedBy'])
        ]);
    }
}