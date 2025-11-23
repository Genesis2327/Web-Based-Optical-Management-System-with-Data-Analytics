<?php

namespace App\Http\Controllers;

use App\Models\EyewearReminder;
use App\Models\EyewearConditionReport;
use App\Models\User;
use App\Models\Product;
use App\Models\Reservation;
use App\Models\Transaction;
use App\Models\Notification;
use App\Services\WebSocketService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class EyewearReminderController extends Controller
{
    /**
     * Get reminders for the logged-in customer
     * GET /api/eyewear-reminders
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();
            
            if (!$user) {
                return response()->json(['error' => 'Unauthorized'], 401);
            }

            $query = EyewearReminder::with(['product', 'reservation', 'transaction'])
                ->where('user_id', $user->id);

            // Filter by active/dismissed
            if ($request->has('is_active')) {
                $query->where('is_active', $request->is_active);
            }

            if ($request->has('is_dismissed')) {
                $query->where('is_dismissed', $request->is_dismissed);
            }

            // Get due reminders
            if ($request->has('due_only') && $request->due_only) {
                $query->due();
            }

            $reminders = $query->orderBy('next_reminder_date', 'asc')->get();

            return response()->json([
                'reminders' => $reminders,
                'count' => $reminders->count(),
                'due_count' => $reminders->filter(fn($r) => $r->isDue())->count()
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to fetch reminders: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to fetch reminders'], 500);
        }
    }

    /**
     * Create a reminder (typically after purchase)
     * POST /api/eyewear-reminders
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'product_id' => 'nullable|exists:products,id',
            'reservation_id' => 'nullable|exists:reservations,id',
            'transaction_id' => 'nullable|exists:transactions,id',
            'product_type' => 'required|in:frame,prescription_lens,contact_lens',
            'purchase_date' => 'nullable|date',
            'contact_lens_expiry' => 'nullable|date|required_if:product_type,contact_lens',
            'contact_lens_cycle_days' => 'nullable|integer|required_if:product_type,contact_lens',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $user = Auth::user();
            $data = $validator->validated();

            // Calculate reminder interval based on product type
            $intervalDays = match($data['product_type']) {
                'frame' => 90, // 3 months
                'prescription_lens' => 180, // 6 months
                'contact_lens' => $data['contact_lens_cycle_days'] ?? 30, // Monthly default
                default => 90
            };

            $purchaseDate = $data['purchase_date'] ?? now();
            $nextReminderDate = Carbon::parse($purchaseDate)->addDays($intervalDays);

            // For contact lenses, use expiry date if available
            if ($data['product_type'] === 'contact_lens' && isset($data['contact_lens_expiry'])) {
                $nextReminderDate = Carbon::parse($data['contact_lens_expiry'])->subDays(7); // Remind 7 days before expiry
            }

            $reminder = EyewearReminder::create([
                'user_id' => $user->id,
                'product_id' => $data['product_id'] ?? null,
                'reservation_id' => $data['reservation_id'] ?? null,
                'transaction_id' => $data['transaction_id'] ?? null,
                'product_type' => $data['product_type'],
                'reminder_type' => 'condition_check',
                'reminder_interval_days' => $intervalDays,
                'purchase_date' => $purchaseDate,
                'next_reminder_date' => $nextReminderDate,
                'contact_lens_expiry' => $data['contact_lens_expiry'] ?? null,
                'contact_lens_cycle_days' => $data['contact_lens_cycle_days'] ?? null,
                'is_active' => true,
            ]);

            Log::info('Eyewear reminder created', [
                'reminder_id' => $reminder->id,
                'user_id' => $user->id,
                'product_type' => $data['product_type'],
                'next_reminder_date' => $nextReminderDate
            ]);

            return response()->json([
                'message' => 'Reminder created successfully',
                'reminder' => $reminder
            ], 201);
        } catch (\Exception $e) {
            Log::error('Failed to create reminder: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to create reminder'], 500);
        }
    }

    /**
     * Dismiss a reminder
     * POST /api/eyewear-reminders/{id}/dismiss
     */
    public function dismiss($id): JsonResponse
    {
        try {
            $user = Auth::user();
            $reminder = EyewearReminder::where('user_id', $user->id)->findOrFail($id);

            $reminder->dismiss();

            return response()->json([
                'message' => 'Reminder dismissed successfully',
                'reminder' => $reminder
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to dismiss reminder: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to dismiss reminder'], 500);
        }
    }

    /**
     * Update condition check date (when customer submits a report)
     * POST /api/eyewear-reminders/{id}/update-check
     */
    public function updateCheck($id): JsonResponse
    {
        try {
            $user = Auth::user();
            $reminder = EyewearReminder::where('user_id', $user->id)->findOrFail($id);

            $reminder->update([
                'last_condition_check' => now(),
                'next_reminder_date' => $reminder->calculateNextReminderDate(),
                'is_dismissed' => false, // Re-activate if dismissed
            ]);

            return response()->json([
                'message' => 'Condition check updated successfully',
                'reminder' => $reminder,
                'next_reminder_date' => $reminder->next_reminder_date
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to update condition check: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to update check'], 500);
        }
    }

    /**
     * Get reminder statistics for admin
     * GET /api/eyewear-reminders/stats
     */
    public function stats(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();
            
            if ($user->role->value !== 'admin') {
                return response()->json(['error' => 'Unauthorized'], 403);
            }

            $totalReminders = EyewearReminder::count();
            $activeReminders = EyewearReminder::where('is_active', true)->where('is_dismissed', false)->count();
            $dueReminders = EyewearReminder::due()->count();
            $dismissedReminders = EyewearReminder::where('is_dismissed', true)->count();

            $byProductType = EyewearReminder::selectRaw('product_type, COUNT(*) as count')
                ->groupBy('product_type')
                ->get()
                ->pluck('count', 'product_type');

            return response()->json([
                'total' => $totalReminders,
                'active' => $activeReminders,
                'due' => $dueReminders,
                'dismissed' => $dismissedReminders,
                'by_product_type' => $byProductType
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to fetch reminder stats: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to fetch stats'], 500);
        }
    }
}
