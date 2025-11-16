<?php

namespace App\Http\Controllers;

use App\Models\Receipt;
use App\Models\ReceiptItem;
use App\Models\Appointment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class ReceiptController extends Controller
{
    public function store(Request $request)
    {
        $user = Auth::user();
        
        // Handle role format
        $userRole = null;
        if (is_object($user->role)) {
            $userRole = $user->role->value ?? (string)$user->role;
        } else {
            $userRole = (string)$user->role;
        }

        if (!in_array($userRole, ['staff', 'admin', 'optometrist'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'appointment_id' => 'required|exists:appointments,id',
            'sales_type' => 'required|in:cash,charge',
            'date' => 'required|date',
            'customer_name' => 'required|string',
            'tin' => 'nullable|string',
            'address' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.description' => 'required|string',
            'items.*.qty' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.amount' => 'required|numeric|min:0',
            'totals.vatable_sales' => 'required|numeric|min:0',
            'totals.vat_amount' => 'required|numeric|min:0',
            'totals.zero_rated_sales' => 'required|numeric|min:0',
            'totals.vat_exempt_sales' => 'required|numeric|min:0',
            'totals.net_of_vat' => 'required|numeric|min:0',
            'totals.less_vat' => 'required|numeric|min:0',
            'totals.add_vat' => 'required|numeric|min:0',
            'totals.discount' => 'required|numeric|min:0',
            'totals.withholding_tax' => 'required|numeric|min:0',
            'totals.total_due' => 'required|numeric|min:0',
        ]);

        $appointment = Appointment::findOrFail($validated['appointment_id']);
        if (in_array($userRole, ['staff', 'optometrist']) && $appointment->branch_id !== $user->branch_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return DB::transaction(function () use ($validated, $appointment) {
            $receipt = Receipt::updateOrCreate(
                ['appointment_id' => $validated['appointment_id']],
                [
                    'customer_id' => $appointment->patient_id,
                    'branch_id' => $appointment->branch_id,
                    'sales_type' => $validated['sales_type'],
                    'date' => $validated['date'],
                    'customer_name' => $validated['customer_name'],
                    'tin' => $validated['tin'] ?? null,
                    'address' => $validated['address'] ?? null,
                    'vatable_sales' => $validated['totals']['vatable_sales'],
                    'vat_amount' => $validated['totals']['vat_amount'],
                    'zero_rated_sales' => $validated['totals']['zero_rated_sales'],
                    'vat_exempt_sales' => $validated['totals']['vat_exempt_sales'],
                    'net_of_vat' => $validated['totals']['net_of_vat'],
                    'less_vat' => $validated['totals']['less_vat'],
                    'add_vat' => $validated['totals']['add_vat'],
                    'discount' => $validated['totals']['discount'],
                    'withholding_tax' => $validated['totals']['withholding_tax'],
                    'total_due' => $validated['totals']['total_due'],
                ]
            );

            // reset items
            $receipt->items()->delete();
            foreach ($validated['items'] as $item) {
                $receipt->items()->create($item);
            }

            return response()->json($receipt->load('items'), 201);
        });
    }

    /**
     * Get receipts for a specific customer
     */
    public function getByCustomer($customerId)
    {
        try {
            $user = Auth::user();
            
            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            // Handle different role formats more robustly
            $userRole = null;
            if (is_object($user->role)) {
                $userRole = $user->role->value ?? (string)$user->role;
            } else {
                $userRole = (string)$user->role;
            }

            // Only customers can access their own receipts, or staff/admin can access any
            if ($userRole === 'customer' && $user->id != $customerId) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            if (!in_array($userRole, ['customer', 'staff', 'admin', 'optometrist'])) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $receipts = Receipt::with(['appointment.patient', 'appointment.optometrist', 'items'])
                ->whereHas('appointment', function($query) use ($customerId) {
                    $query->where('patient_id', $customerId);
                })
                ->orderBy('created_at', 'desc')
                ->get();

        return response()->json([
            'data' => $receipts->map(function($receipt) {
                return [
                    'id' => $receipt->id,
                    'receipt_number' => str_pad($receipt->appointment_id, 4, '0', STR_PAD_LEFT),
                    'customer_id' => $receipt->appointment->patient_id,
                    'appointment_id' => $receipt->appointment_id,
                    'subtotal' => $receipt->vatable_sales,
                    'tax_amount' => $receipt->vat_amount,
                    'total_amount' => $receipt->total_due,
                    'payment_method' => $receipt->sales_type,
                    'payment_status' => 'paid',
                    'notes' => null,
                    'items' => $receipt->items->map(function($item) {
                        return [
                            'description' => $item->description,
                            'quantity' => $item->qty,
                            'price' => $item->unit_price,
                            'total' => $item->amount,
                        ];
                    }),
                    'created_at' => $receipt->created_at->toISOString(),
                    'updated_at' => $receipt->updated_at->toISOString(),
                    'customer' => [
                        'id' => $receipt->appointment->patient_id,
                        'name' => $receipt->customer_name,
                        'email' => $receipt->appointment->patient->email ?? '',
                    ],
                    'appointment' => [
                        'id' => $receipt->appointment->id,
                        'appointment_date' => $receipt->appointment->appointment_date,
                        'start_time' => $receipt->appointment->start_time,
                        'end_time' => $receipt->appointment->end_time,
                        'type' => $receipt->appointment->type,
                        'optometrist' => $receipt->appointment->optometrist ? [
                            'id' => $receipt->appointment->optometrist->id,
                            'name' => $receipt->appointment->optometrist->name,
                        ] : null,
                    ],
                ];
            }),
            'pagination' => [
                'current_page' => 1,
                'last_page' => 1,
                'per_page' => $receipts->count(),
                'total' => $receipts->count(),
            ]
        ]);

        } catch (\Exception $e) {
            \Log::error('Error in getByCustomer: ' . $e->getMessage());
            \Log::error('Stack trace: ' . $e->getTraceAsString());
            
            return response()->json([
                'data' => [],
                'error' => 'An error occurred while fetching receipts',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get receipts for a specific customer
     */
    public function getCustomerReceipts($customerId)
    {
        $user = Auth::user();

        // Only customers can access their own receipts, or staff/admin can access any
        if ($user->role->value === 'customer' && $user->id != $customerId) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if (!in_array($user->role->value, ['customer', 'staff', 'admin', 'optometrist'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $receipts = Receipt::with(['appointment.patient', 'appointment.optometrist', 'items'])
            ->whereHas('appointment', function($query) use ($customerId) {
                $query->where('patient_id', $customerId);
            })
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'data' => $receipts->map(function($receipt) {
                return [
                    'id' => $receipt->id,
                    'receipt_number' => str_pad($receipt->appointment_id, 4, '0', STR_PAD_LEFT),
                    'customer_id' => $receipt->appointment->patient_id,
                    'appointment_id' => $receipt->appointment_id,
                    'subtotal' => $receipt->vatable_sales,
                    'tax_amount' => $receipt->vat_amount,
                    'total_amount' => $receipt->total_due,
                    'payment_method' => $receipt->sales_type,
                    'payment_status' => 'paid',
                    'notes' => null,
                    'items' => $receipt->items->map(function($item) {
                        return [
                            'description' => $item->description,
                            'quantity' => $item->qty,
                            'price' => $item->unit_price,
                            'total' => $item->amount,
                        ];
                    }),
                    'created_at' => $receipt->created_at->toISOString(),
                    'updated_at' => $receipt->updated_at->toISOString(),
                    'customer' => [
                        'id' => $receipt->appointment->patient_id,
                        'name' => $receipt->customer_name,
                        'email' => $receipt->appointment->patient->email ?? '',
                    ],
                    'appointment' => [
                        'id' => $receipt->appointment_id,
                        'appointment_date' => $receipt->appointment->appointment_date,
                        'start_time' => $receipt->appointment->start_time,
                        'end_time' => $receipt->appointment->end_time,
                        'type' => $receipt->appointment->type,
                        'optometrist' => $receipt->appointment->optometrist ? [
                            'id' => $receipt->appointment->optometrist->id,
                            'name' => $receipt->appointment->optometrist->name,
                        ] : null,
                    ],
                ];
            }),
            'pagination' => [
                'current_page' => 1,
                'last_page' => 1,
                'per_page' => $receipts->count(),
                'total' => $receipts->count(),
            ]
        ]);
    }

    /**
     * Get a specific receipt
     */
    public function getReceipt($receiptId)
    {
        $user = Auth::user();
        $receipt = Receipt::with(['appointment.patient', 'appointment.optometrist', 'items'])->findOrFail($receiptId);
        
        // Handle role format
        $userRole = null;
        if (is_object($user->role)) {
            $userRole = $user->role->value ?? (string)$user->role;
        } else {
            $userRole = (string)$user->role;
        }

        // Check if user can access this receipt
        if ($userRole === 'customer' && $receipt->appointment->patient_id !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if (in_array($userRole, ['staff', 'optometrist']) && $receipt->appointment->branch_id !== $user->branch_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return response()->json([
            'id' => $receipt->id,
            'receipt_number' => str_pad($receipt->appointment_id, 4, '0', STR_PAD_LEFT),
            'customer_id' => $receipt->appointment->patient_id,
            'appointment_id' => $receipt->appointment_id,
            'subtotal' => $receipt->vatable_sales,
            'tax_amount' => $receipt->vat_amount,
            'total_amount' => $receipt->total_due,
            'payment_method' => $receipt->sales_type,
            'payment_status' => 'paid',
            'notes' => null,
            'items' => $receipt->items->map(function($item) {
                return [
                    'description' => $item->description,
                    'quantity' => $item->qty,
                    'price' => $item->unit_price,
                    'total' => $item->amount,
                ];
            }),
            'created_at' => $receipt->created_at->toISOString(),
            'updated_at' => $receipt->updated_at->toISOString(),
            'customer' => [
                'id' => $receipt->appointment->patient_id,
                'name' => $receipt->customer_name,
                'email' => $receipt->appointment->patient->email ?? '',
            ],
            'appointment' => [
                'id' => $receipt->appointment_id,
                'appointment_date' => $receipt->appointment->appointment_date,
                'start_time' => $receipt->appointment->start_time,
                'end_time' => $receipt->appointment->end_time,
                'type' => $receipt->appointment->type,
                'optometrist' => $receipt->appointment->optometrist ? [
                    'id' => $receipt->appointment->optometrist->id,
                    'name' => $receipt->appointment->optometrist->name,
                ] : null,
            ],
        ]);
    }

    /**
     * Download receipt PDF
     */
    public function downloadReceipt($receiptId)
    {
        $user = Auth::user();
        $receipt = Receipt::with(['appointment.patient', 'appointment.optometrist', 'items'])->findOrFail($receiptId);
        
        // Handle role format
        $userRole = null;
        if (is_object($user->role)) {
            $userRole = $user->role->value ?? (string)$user->role;
        } else {
            $userRole = (string)$user->role;
        }

        // Check if user can access this receipt
        if ($userRole === 'customer' && $receipt->appointment->patient_id !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if (in_array($userRole, ['staff', 'optometrist']) && $receipt->appointment->branch_id !== $user->branch_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Generate PDF using the existing PdfController
        $pdfController = new \App\Http\Controllers\PdfController();
        return $pdfController->downloadReceipt($receipt->appointment_id);
    }
}
