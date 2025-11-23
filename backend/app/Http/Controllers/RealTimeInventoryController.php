<?php

namespace App\Http\Controllers;

use App\Models\BranchStock;
use App\Models\Product;
use App\Models\Branch;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class RealTimeInventoryController extends Controller
{
    /**
     * Get real-time inventory status for all products across branches
     */
    public function getRealTimeInventory(Request $request): JsonResponse
    {
        $user = Auth::user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $branchId = $request->get('branch_id');
        $productId = $request->get('product_id');
        $includeOutOfStock = $request->boolean('include_out_of_stock', false);

        // Use cache for better performance (5 minutes cache)
        $cacheKey = "realtime_inventory_" . md5(serialize([
            'branch_id' => $branchId,
            'product_id' => $productId,
            'include_out_of_stock' => $includeOutOfStock,
            'user_role' => $user->role->value,
            'user_branch_id' => $user->branch_id,
        ]));

        $inventory = Cache::remember($cacheKey, 300, function () use ($branchId, $productId, $includeOutOfStock, $user) {
            $query = BranchStock::with(['product', 'branch'])
                ->select('*')
                ->selectRaw('(stock_quantity - reserved_quantity) as available_quantity');

            if ($productId) {
                $query->where('product_id', $productId);
            }

            if ($branchId) {
                $query->where('branch_id', $branchId);
            }

            // Staff can only see their branch
            if ($user->role->value === 'staff' && $user->branch_id) {
                $query->where('branch_id', $user->branch_id);
            }

            if (!$includeOutOfStock) {
                $query->whereRaw('stock_quantity > reserved_quantity');
            }

            return $query->get();
        });

        $inventoryData = $inventory->map(function ($stock) {
            return [
                'id' => $stock->id,
                'product' => [
                    'id' => $stock->product_id,
                    'name' => $stock->product->name,
                    'sku' => $stock->product->sku,
                    'category' => $stock->product->category,
                ],
                'branch' => [
                    'id' => $stock->branch_id,
                    'name' => $stock->branch->name,
                    'code' => $stock->branch->code,
                ],
                'stock' => [
                    'available_quantity' => $stock->available_quantity,
                    'stock_quantity' => $stock->stock_quantity,
                    'reserved_quantity' => $stock->reserved_quantity,
                    'is_available' => $stock->available_quantity > 0,
                    'is_low_stock' => $stock->available_quantity <= ($stock->min_stock_threshold ?? 5),
                    'status' => $this->getStockStatus($stock->available_quantity, $stock->min_stock_threshold ?? 5),
                ],
                'metadata' => [
                    'last_updated' => $stock->updated_at,
                    'expiry_date' => $stock->expiry_date,
                    'auto_restock_enabled' => $stock->auto_restock_enabled ?? false,
                ],
            ];
        });

        // Clear cache if this is a real-time request
        if ($request->boolean('force_refresh')) {
            Cache::forget($cacheKey);
        }

        return response()->json([
            'inventory' => $inventoryData,
            'summary' => [
                'total_items' => $inventoryData->count(),
                'in_stock' => $inventoryData->where('stock.is_available', true)->count(),
                'low_stock' => $inventoryData->where('stock.is_low_stock', true)->count(),
                'out_of_stock' => $inventoryData->where('stock.is_available', false)->count(),
                'total_available_quantity' => $inventoryData->sum('stock.available_quantity'),
            ],
            'timestamp' => now(),
            'cache_expires_at' => now()->addMinutes(5),
        ]);
    }

    /**
     * Get immediate stock alerts and notifications
     */
    public function getImmediateAlerts(): JsonResponse
    {
        $user = Auth::user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $alerts = [];

        // Out of stock alerts
        $outOfStockQuery = BranchStock::with(['product', 'branch'])
            ->whereRaw('stock_quantity <= reserved_quantity');

        if ($user->role->value === 'staff' && $user->branch_id) {
            $outOfStockQuery->where('branch_id', $user->branch_id);
        }

        $outOfStockItems = $outOfStockQuery->get();

        foreach ($outOfStockItems as $stock) {
            $alerts[] = [
                'type' => 'out_of_stock',
                'severity' => 'critical',
                'title' => 'Out of Stock',
                'message' => "{$stock->product->name} is out of stock at {$stock->branch->name}",
                'product_id' => $stock->product_id,
                'branch_id' => $stock->branch_id,
                'timestamp' => now(),
                'action_required' => true,
            ];
        }

        // Low stock alerts
        $lowStockQuery = BranchStock::with(['product', 'branch'])
            ->whereRaw('(stock_quantity - reserved_quantity) <= COALESCE(min_stock_threshold, 5)')
            ->whereRaw('stock_quantity > reserved_quantity');

        if ($user->role->value === 'staff' && $user->branch_id) {
            $lowStockQuery->where('branch_id', $user->branch_id);
        }

        $lowStockItems = $lowStockQuery->get();

        foreach ($lowStockItems as $stock) {
            $alerts[] = [
                'type' => 'low_stock',
                'severity' => 'warning',
                'title' => 'Low Stock',
                'message' => "{$stock->product->name} is running low at {$stock->branch->name} ({$stock->available_quantity} remaining)",
                'product_id' => $stock->product_id,
                'branch_id' => $stock->branch_id,
                'available_quantity' => $stock->available_quantity,
                'timestamp' => now(),
                'action_required' => true,
            ];
        }

        // Expiring items alerts
        $expiringQuery = BranchStock::with(['product', 'branch'])
            ->where('expiry_date', '<=', now()->addDays(30))
            ->where('expiry_date', '>', now())
            ->whereRaw('stock_quantity > reserved_quantity');

        if ($user->role->value === 'staff' && $user->branch_id) {
            $expiringQuery->where('branch_id', $user->branch_id);
        }

        $expiringItems = $expiringQuery->get();

        foreach ($expiringItems as $stock) {
            $daysUntilExpiry = now()->diffInDays($stock->expiry_date);
            $alerts[] = [
                'type' => 'expiring',
                'severity' => $daysUntilExpiry <= 7 ? 'warning' : 'info',
                'title' => 'Expiring Soon',
                'message' => "{$stock->product->name} expires in {$daysUntilExpiry} days at {$stock->branch->name}",
                'product_id' => $stock->product_id,
                'branch_id' => $stock->branch_id,
                'expiry_date' => $stock->expiry_date,
                'days_until_expiry' => $daysUntilExpiry,
                'timestamp' => now(),
                'action_required' => $daysUntilExpiry <= 7,
            ];
        }

        return response()->json([
            'alerts' => $alerts,
            'summary' => [
                'total_alerts' => count($alerts),
                'critical_alerts' => collect($alerts)->where('severity', 'critical')->count(),
                'warning_alerts' => collect($alerts)->where('severity', 'warning')->count(),
                'info_alerts' => collect($alerts)->where('severity', 'info')->count(),
                'action_required' => collect($alerts)->where('action_required', true)->count(),
            ],
            'timestamp' => now(),
        ]);
    }

    /**
     * Update stock quantity with real-time validation
     */
    public function updateStockQuantity(Request $request, BranchStock $branchStock): JsonResponse
    {
        $user = Auth::user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        // Validate permissions
        if ($user->role->value === 'staff' && $user->branch_id !== $branchStock->branch_id) {
            return response()->json(['message' => 'Unauthorized to update this branch stock'], 403);
        }

        $request->validate([
            'stock_quantity' => 'required|integer|min:0',
            'reason' => 'nullable|string|max:500',
        ]);

        $oldQuantity = $branchStock->stock_quantity;
        $newQuantity = (int) $request->stock_quantity; // Explicitly cast to int to ensure 0 is saved

        $branchStock->update([
            'stock_quantity' => $newQuantity,
        ]);

        // Clear related cache for this branch
        $this->clearInventoryCache($branchStock->branch_id);

        // Log the change
        Log::info('Stock quantity updated', [
            'user_id' => $user->id,
            'branch_stock_id' => $branchStock->id,
            'product_id' => $branchStock->product_id,
            'branch_id' => $branchStock->branch_id,
            'old_quantity' => $oldQuantity,
            'new_quantity' => $newQuantity,
            'reason' => $request->reason,
        ]);

        return response()->json([
            'message' => 'Stock quantity updated successfully',
            'branch_stock' => $branchStock->fresh(['product', 'branch']),
            'change' => [
                'old_quantity' => $oldQuantity,
                'new_quantity' => $newQuantity,
                'difference' => $newQuantity - $oldQuantity,
            ],
        ]);
    }

    /**
     * Get stock status based on quantity and threshold
     */
    private function getStockStatus(int $availableQuantity, int $threshold): string
    {
        if ($availableQuantity <= 0) {
            return 'out_of_stock';
        } elseif ($availableQuantity <= $threshold) {
            return 'low_stock';
        } else {
            return 'in_stock';
        }
    }

    /**
     * Clear inventory cache for a specific branch or all branches
     * Since Laravel cache doesn't support wildcard deletion, we'll clear
     * all cache when stock is updated to ensure fresh data
     */
    private function clearInventoryCache($branchId = null): void
    {
        // Get user info for cache key generation
        $user = Auth::user();
        $userRole = $user?->role?->value ?? 'customer';
        $userBranchId = $user?->branch_id ?? null;

        // Clear all possible cache variations for realtime inventory
        // This includes all combinations of filters that might be cached
        $variations = [
            ['branch_id' => $branchId, 'product_id' => null, 'include_out_of_stock' => false],
            ['branch_id' => $branchId, 'product_id' => null, 'include_out_of_stock' => true],
            ['branch_id' => null, 'product_id' => null, 'include_out_of_stock' => false],
            ['branch_id' => null, 'product_id' => null, 'include_out_of_stock' => true],
        ];

        foreach ($variations as $variation) {
            $cacheKey = "realtime_inventory_" . md5(serialize([
                'branch_id' => $variation['branch_id'],
                'product_id' => $variation['product_id'],
                'include_out_of_stock' => $variation['include_out_of_stock'],
                'user_role' => $userRole,
                'user_branch_id' => $userBranchId,
            ]));
            Cache::forget($cacheKey);
        }
        
        // Clear enhanced inventory cache (all variations)
        Cache::forget('enhanced_inventory_all');
        if ($branchId) {
            Cache::forget('enhanced_inventory_branch_' . $branchId);
        }
        
        // Clear stock alerts cache
        Cache::forget('stock_alerts_' . ($branchId ?? 'all'));
        Cache::forget('stock_alerts_all');
    }
}




