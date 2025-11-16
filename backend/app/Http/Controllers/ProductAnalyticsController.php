<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Reservation;
use App\Models\Receipt;
use App\Models\ReceiptItem;
use App\Models\Branch;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;

class ProductAnalyticsController extends Controller
{
    /**
     * Get top-selling products with accurate sales data and trends
     * GET /api/admin/products/analytics
     */
    public function getTopSellingProducts(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        if (!$user || $user->role->value !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $period = $request->get('period', 30); // days
        $branchId = $request->get('branch_id');
        $limit = $request->get('limit', 10);
        
        $startDate = Carbon::now()->subDays($period);
        $previousPeriodStart = Carbon::now()->subDays($period * 2);
        $previousPeriodEnd = Carbon::now()->subDays($period);

        // Base query for current period
        $currentPeriodQuery = DB::table('reservations')
            ->join('products', 'reservations.product_id', '=', 'products.id')
            ->where('reservations.status', 'completed')
            ->where('reservations.created_at', '>=', $startDate);

        // Add branch filter if specified
        if ($branchId) {
            $currentPeriodQuery->where('reservations.branch_id', $branchId);
        }

        // Get current period sales data
        $currentSales = $currentPeriodQuery
            ->leftJoin('product_categories', 'products.category_id', '=', 'product_categories.id')
            ->select(
                'products.id',
                'products.name',
                'product_categories.name as category',
                'products.price',
                DB::raw('SUM(reservations.quantity) as units_sold'),
                DB::raw('SUM(reservations.quantity * products.price) as revenue')
            )
            ->groupBy('products.id', 'products.name', 'product_categories.name', 'products.price')
            ->orderByDesc('units_sold')
            ->limit($limit)
            ->get();

        // Get previous period sales for trend calculation
        $previousSales = DB::table('reservations')
            ->join('products', 'reservations.product_id', '=', 'products.id')
            ->where('reservations.status', 'completed')
            ->whereBetween('reservations.created_at', [$previousPeriodStart, $previousPeriodEnd]);

        if ($branchId) {
            $previousSales->where('reservations.branch_id', $branchId);
        }

        $previousSalesData = $previousSales
            ->select(
                'products.id',
                DB::raw('SUM(reservations.quantity) as units_sold'),
                DB::raw('SUM(reservations.quantity * products.price) as revenue')
            )
            ->groupBy('products.id')
            ->get()
            ->keyBy('id');

        // Also get sales from receipts for more comprehensive data
        $receiptSales = $this->getReceiptSales($startDate, $branchId);
        $previousReceiptSales = $this->getReceiptSales($previousPeriodStart, $branchId, $previousPeriodEnd);

        // Combine reservation and receipt data
        $topProducts = [];
        foreach ($currentSales as $product) {
            $productId = $product->id;
            
            // Get reservation sales
            $reservationUnits = $product->units_sold;
            $reservationRevenue = $product->revenue;
            
            // Get receipt sales for this product
            $receiptData = $receiptSales->get($productId, (object)['units_sold' => 0, 'revenue' => 0]);
            $receiptUnits = $receiptData->units_sold;
            $receiptRevenue = $receiptData->revenue;
            
            // Calculate totals
            $totalUnits = $reservationUnits + $receiptUnits;
            $totalRevenue = $reservationRevenue + $receiptRevenue;
            
            // Get previous period data
            $previousData = $previousSalesData->get($productId, (object)['units_sold' => 0, 'revenue' => 0]);
            $previousReceiptData = $previousReceiptSales->get($productId, (object)['units_sold' => 0, 'revenue' => 0]);
            
            $previousTotalUnits = $previousData->units_sold + $previousReceiptData->units_sold;
            
            // Calculate trend percentage
            $trendPercentage = 0;
            if ($previousTotalUnits > 0) {
                $trendPercentage = (($totalUnits - $previousTotalUnits) / $previousTotalUnits) * 100;
            } else if ($totalUnits > 0) {
                $trendPercentage = 100; // New product or first sales
            }

            $topProducts[] = [
                'id' => $product->id,
                'name' => $product->name,
                'category' => $product->category,
                'price' => $product->price,
                'units_sold' => $totalUnits,
                'revenue' => $totalRevenue,
                'trend_percentage' => round($trendPercentage, 1),
                'previous_units' => $previousTotalUnits,
                'reservation_units' => $reservationUnits,
                'receipt_units' => $receiptUnits,
            ];
        }

        // Sort by units sold
        usort($topProducts, function($a, $b) {
            return $b['units_sold'] - $a['units_sold'];
        });

        // Get summary statistics
        $summary = [
            'total_products_sold' => count($topProducts),
            'total_units_sold' => array_sum(array_column($topProducts, 'units_sold')),
            'total_revenue' => array_sum(array_column($topProducts, 'revenue')),
            'period_days' => $period,
            'date_range' => [
                'start' => $startDate->format('Y-m-d'),
                'end' => Carbon::now()->format('Y-m-d'),
            ],
        ];

        return response()->json([
            'top_products' => $topProducts,
            'summary' => $summary,
            'branch_id' => $branchId,
        ]);
    }

    /**
     * Get sales data from receipts
     */
    private function getReceiptSales($startDate, $branchId = null, $endDate = null)
    {
        $query = DB::table('receipt_items')
            ->join('receipts', 'receipt_items.receipt_id', '=', 'receipts.id')
            ->where('receipts.payment_status', 'paid')
            ->where('receipts.date', '>=', $startDate->format('Y-m-d'));

        if ($endDate) {
            $query->where('receipts.date', '<=', $endDate->format('Y-m-d'));
        }

        if ($branchId) {
            $query->where('receipts.branch_id', $branchId);
        }

        return $query
            ->select(
                'receipt_items.description',
                DB::raw('SUM(receipt_items.qty) as units_sold'),
                DB::raw('SUM(receipt_items.amount) as revenue')
            )
            ->groupBy('receipt_items.description')
            ->get()
            ->mapWithKeys(function ($item) {
                // Try to match receipt items to products by name
                $product = Product::where('name', 'LIKE', '%' . $item->description . '%')->first();
                if ($product) {
                    return [$product->id => $item];
                }
                return [];
            });
    }

    /**
     * Get product performance by category
     * GET /api/admin/products/category-analytics
     */
    public function getCategoryAnalytics(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        if (!$user || $user->role->value !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $period = $request->get('period', 30);
        $startDate = Carbon::now()->subDays($period);

        $categorySales = DB::table('reservation_items')
            ->join('reservations', 'reservation_items.reservation_id', '=', 'reservations.id')
            ->join('products', 'reservation_items.product_id', '=', 'products.id')
            ->leftJoin('product_categories', 'products.category_id', '=', 'product_categories.id')
            ->where('reservations.status', 'completed')
            ->where('reservations.created_at', '>=', $startDate)
            ->select(
                'product_categories.name as category',
                DB::raw('SUM(reservation_items.quantity) as units_sold'),
                DB::raw('SUM(reservation_items.quantity * products.price) as revenue'),
                DB::raw('COUNT(DISTINCT products.id) as unique_products')
            )
            ->groupBy('product_categories.name')
            ->orderByDesc('units_sold')
            ->get();

        return response()->json([
            'category_analytics' => $categorySales,
            'period_days' => $period,
            'date_range' => [
                'start' => $startDate->format('Y-m-d'),
                'end' => Carbon::now()->format('Y-m-d'),
            ],
        ]);
    }

    /**
     * Get low-performing products
     * GET /api/admin/products/low-performing
     */
    public function getLowPerformingProducts(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        if (!$user || $user->role->value !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $period = $request->get('period', 30);
        $startDate = Carbon::now()->subDays($period);

        // Get products with low sales
        $lowPerformingProducts = DB::table('products')
            ->leftJoin('reservation_items', function($join) use ($startDate) {
                $join->on('products.id', '=', 'reservation_items.product_id')
                     ->join('reservations', 'reservation_items.reservation_id', '=', 'reservations.id')
                     ->where('reservations.status', 'completed')
                     ->where('reservations.created_at', '>=', $startDate);
            })
            ->leftJoin('product_categories', 'products.category_id', '=', 'product_categories.id')
            ->where('products.is_active', true)
            ->select(
                'products.id',
                'products.name',
                'product_categories.name as category',
                'products.price',
                DB::raw('COALESCE(SUM(reservation_items.quantity), 0) as units_sold'),
                DB::raw('COALESCE(SUM(reservation_items.quantity * products.price), 0) as revenue')
            )
            ->groupBy('products.id', 'products.name', 'product_categories.name', 'products.price')
            ->having('units_sold', '<', 5) // Less than 5 units sold
            ->orderBy('units_sold', 'asc')
            ->get();

        return response()->json([
            'low_performing_products' => $lowPerformingProducts,
            'period_days' => $period,
            'threshold' => 5,
        ]);
    }
}
