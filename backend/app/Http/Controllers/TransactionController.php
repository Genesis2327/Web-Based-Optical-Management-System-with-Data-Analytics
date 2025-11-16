<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\Reservation;
use App\Models\Transaction;
use App\Models\Receipt;
use App\Models\ReceiptItem;
use App\Models\BranchStock;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Barryvdh\DomPDF\Facade\Pdf;

class TransactionController extends Controller
{
    /**
     * Complete a transaction (both appointment and reservation)
     */
    public function complete(Request $request)
    {
        $user = Auth::user();
        
        // Handle role format
        $userRole = null;
        if (is_object($user->role)) {
            $userRole = $user->role->value ?? (string)$user->role;
        } else {
            $userRole = (string)$user->role;
        }

        // Only staff, optometrist, and admin can complete transactions
        if (!in_array($userRole, ['staff', 'optometrist', 'admin'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'appointment_id' => 'required|exists:appointments,id',
            'reservation_id' => 'required|exists:reservations,id',
            'sales_type' => 'required|in:cash,charge',
            'customer_name' => 'required|string',
            'tin' => 'nullable|string',
            'address' => 'nullable|string',
            'eye_exam_fee' => 'required|numeric|min:0',
        ]);

        return DB::transaction(function () use ($validated, $user) {
            // Get the appointment and reservation
            $appointment = Appointment::with(['patient', 'optometrist', 'branch'])->findOrFail($validated['appointment_id']);
            $reservation = Reservation::with(['user', 'product', 'branch'])->findOrFail($validated['reservation_id']);

            // Check if both belong to the same transaction
            if ($appointment->transaction_id !== $reservation->transaction_id) {
                return response()->json(['message' => 'Appointment and reservation are not linked'], 400);
            }

            // Check if both are completed
            if ($appointment->status !== 'completed' || $reservation->status !== 'completed') {
                return response()->json(['message' => 'Both appointment and reservation must be completed first'], 400);
            }

            // Check branch access for staff/optometrist
            if (in_array($user->role->value, ['staff', 'optometrist']) && 
                ($appointment->branch_id !== $user->branch_id || $reservation->branch_id !== $user->branch_id)) {
                return response()->json(['message' => 'Unauthorized for this branch'], 403);
            }

            // Calculate totals
            $productPrice = $reservation->product->price * $reservation->quantity;
            $eyeExamFee = $validated['eye_exam_fee'];
            $subtotal = $productPrice + $eyeExamFee;
            
            // Calculate VAT (12%)
            $vatRate = 0.12;
            $vatableAmount = $subtotal / (1 + $vatRate);
            $vatAmount = $subtotal - $vatableAmount;

            // Create receipt
            $receipt = Receipt::create([
                'customer_id' => $appointment->patient_id,
                'branch_id' => $appointment->branch_id,
                'reservation_id' => $reservation->id,
                'appointment_id' => $appointment->id,
                'sales_type' => $validated['sales_type'],
                'date' => now()->toDateString(),
                'customer_name' => $validated['customer_name'],
                'tin' => $validated['tin'] ?? null,
                'address' => $validated['address'] ?? null,
                'vatable_sales' => $vatableAmount,
                'vat_amount' => $vatAmount,
                'zero_rated_sales' => 0,
                'vat_exempt_sales' => 0,
                'net_of_vat' => $vatableAmount,
                'less_vat' => $vatAmount,
                'add_vat' => $vatAmount,
                'discount' => 0,
                'withholding_tax' => 0,
                'total_due' => $subtotal,
            ]);

            // Create receipt items
            $receipt->items()->create([
                'description' => $reservation->product->name,
                'qty' => $reservation->quantity,
                'unit_price' => $reservation->product->price,
                'amount' => $productPrice,
            ]);

            $receipt->items()->create([
                'description' => 'Eye Examination',
                'qty' => 1,
                'unit_price' => $eyeExamFee,
                'amount' => $eyeExamFee,
            ]);

            // Update branch stock
            $branchStock = BranchStock::where('product_id', $reservation->product_id)
                ->where('branch_id', $reservation->branch_id)
                ->first();

            if ($branchStock) {
                $branchStock->decrement('quantity', $reservation->quantity);
            }

            // Generate PDF receipt
            $receiptData = [
                'invoice_no' => str_pad($receipt->id, 4, '0', STR_PAD_LEFT),
                'date' => $receipt->date->format('Y-m-d'),
                'sales_type' => $receipt->sales_type,
                'customer_name' => $receipt->customer_name,
                'tin' => $receipt->tin,
                'address' => $receipt->address,
                'items' => $receipt->items->map(function($item) {
                    return [
                        'description' => $item->description,
                        'qty' => $item->qty,
                        'unit_price' => $item->unit_price,
                        'amount' => $item->amount,
                    ];
                })->toArray(),
                'total_sales' => $subtotal,
                'vatable_sales' => $vatableAmount,
                'less_vat' => $vatAmount,
                'add_vat' => $vatAmount,
                'zero_rated_sales' => 0,
                'net_of_vat' => $vatableAmount,
                'vat_exempt_sales' => 0,
                'discount' => 0,
                'withholding_tax' => 0,
                'total_due' => $subtotal,
                'branch' => $appointment->branch,
                'optometrist' => $appointment->optometrist,
            ];

            // Create notifications
            $this->createNotifications($appointment, $reservation, $receipt);

            return response()->json([
                'message' => 'Transaction completed successfully',
                'receipt' => $receipt->load('items'),
                'pdf_data' => $receiptData,
            ], 201);
        });
    }

    /**
     * Get linked appointments and reservations
     */
    public function getLinkedTransactions(Request $request)
    {
        $user = Auth::user();
        
        if (!in_array($user->role->value, ['staff', 'optometrist', 'admin'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $branchId = $user->role->value === 'admin' ? null : $user->branch_id;

        $query = Appointment::with(['patient', 'optometrist', 'branch'])
            ->whereNotNull('transaction_id');

        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        $appointments = $query->get();

        $linkedTransactions = $appointments->map(function($appointment) {
            $reservation = Reservation::with(['user', 'product'])
                ->where('transaction_id', $appointment->transaction_id)
                ->first();

            return [
                'appointment' => $appointment,
                'reservation' => $reservation,
                'transaction_id' => $appointment->transaction_id,
                'can_create_receipt' => $appointment->status === 'completed' && 
                                      $reservation && 
                                      $reservation->status === 'completed',
            ];
        });

        return response()->json([
            'linked_transactions' => $linkedTransactions,
        ]);
    }

    /**
     * Create notifications for completed transaction
     */
    private function createNotifications($appointment, $reservation, $receipt)
    {
        // Notify customer
        Notification::create([
            'user_id' => $appointment->patient_id,
            'type' => 'transaction_completed',
            'title' => 'Transaction Completed',
            'message' => 'Your eyewear and eye exam are completed. Receipt #' . str_pad($receipt->id, 4, '0', STR_PAD_LEFT) . ' is ready for download.',
            'data' => json_encode([
                'appointment_id' => $appointment->id,
                'reservation_id' => $reservation->id,
                'receipt_id' => $receipt->id,
            ]),
        ]);

        // Notify optometrist
        Notification::create([
            'user_id' => $appointment->optometrist_id,
            'type' => 'transaction_completed',
            'title' => 'Transaction Completed',
            'message' => 'Transaction completed for ' . $appointment->patient->name . '. Receipt generated.',
            'data' => json_encode([
                'appointment_id' => $appointment->id,
                'reservation_id' => $reservation->id,
                'receipt_id' => $receipt->id,
            ]),
        ]);

        // Notify admin
        $admins = \App\Models\User::where('role', 'admin')->get();
        foreach ($admins as $admin) {
            Notification::create([
                'user_id' => $admin->id,
                'type' => 'transaction_completed',
                'title' => 'Transaction Completed',
                'message' => 'Transaction completed for ' . $appointment->patient->name . ' at ' . $appointment->branch->name . '. Receipt #' . str_pad($receipt->id, 4, '0', STR_PAD_LEFT) . ' generated.',
                'data' => json_encode([
                    'appointment_id' => $appointment->id,
                    'reservation_id' => $reservation->id,
                    'receipt_id' => $receipt->id,
                ]),
            ]);
        }
    }

    /**
     * Generate PDF receipt
     */
    public function generateReceiptPdf($receiptId)
    {
        $receipt = Receipt::with(['appointment.patient', 'appointment.optometrist', 'appointment.branch', 'items'])
            ->findOrFail($receiptId);

        $receiptData = [
            'invoice_no' => str_pad($receipt->id, 4, '0', STR_PAD_LEFT),
            'date' => $receipt->date->format('Y-m-d'),
            'sales_type' => $receipt->sales_type,
            'customer_name' => $receipt->customer_name,
            'tin' => $receipt->tin,
            'address' => $receipt->address,
            'items' => $receipt->items->map(function($item) {
                return [
                    'description' => $item->description,
                    'qty' => $item->qty,
                    'unit_price' => $item->unit_price,
                    'amount' => $item->amount,
                ];
            })->toArray(),
            'total_sales' => $receipt->total_due,
            'vatable_sales' => $receipt->vatable_sales,
            'less_vat' => $receipt->less_vat,
            'add_vat' => $receipt->add_vat,
            'zero_rated_sales' => $receipt->zero_rated_sales,
            'net_of_vat' => $receipt->net_of_vat,
            'vat_exempt_sales' => $receipt->vat_exempt_sales,
            'discount' => $receipt->discount,
            'withholding_tax' => $receipt->withholding_tax,
            'total_due' => $receipt->total_due,
            'branch' => $receipt->appointment->branch,
            'optometrist' => $receipt->appointment->optometrist,
        ];

        $pdf = Pdf::loadView('pdf.receipt', $receiptData);
        return $pdf->download('receipt_' . str_pad($receipt->id, 4, '0', STR_PAD_LEFT) . '.pdf');
    }

    /**
     * Create a new transaction when appointment or reservation is confirmed
     * 
     * ⚠️ LIMITATION: Online payment methods (Credit Card, Debit Card, Online Payment) are
     * accepted and recorded in the database but do not integrate with actual payment gateway
     * providers. These are mock implementations for demonstration purposes only. Only Cash
     * payments involve real transaction processing. Online payment transactions are recorded
     * without processing real financial transactions through external payment processors.
     */
    public function createTransaction(Request $request)
    {
        $user = Auth::user();
        
        // Only staff, optometrist, and admin can create transactions
        if (!in_array($user->role->value, ['staff', 'optometrist', 'admin'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'appointment_id' => 'nullable|exists:appointments,id',
            'reservation_id' => 'nullable|exists:reservations,id',
            'customer_id' => 'required|exists:users,id',
            'branch_id' => 'required|exists:branches,id',
            'total_amount' => 'required|numeric|min:0',
            // NOTE: Online payment methods are mock implementations only
            'payment_method' => 'required|in:Cash,Credit Card,Debit Card,Online Payment',
            'notes' => 'nullable|string',
        ]);

        // Ensure at least one of appointment_id or reservation_id is provided
        if (!$validated['appointment_id'] && !$validated['reservation_id']) {
            return response()->json(['message' => 'Either appointment_id or reservation_id must be provided'], 400);
        }

        return DB::transaction(function () use ($validated, $user) {
            // Check branch access for staff/optometrist
            if (in_array($user->role->value, ['staff', 'optometrist']) && 
                $validated['branch_id'] !== $user->branch_id) {
                return response()->json(['message' => 'Unauthorized for this branch'], 403);
            }

            // Create the transaction
            $transaction = Transaction::create([
                'customer_id' => $validated['customer_id'],
                'branch_id' => $validated['branch_id'],
                'appointment_id' => $validated['appointment_id'],
                'reservation_id' => $validated['reservation_id'],
                'total_amount' => $validated['total_amount'],
                'payment_method' => $validated['payment_method'],
                'notes' => $validated['notes'],
            ]);

            // Update appointment and reservation with transaction_id
            if ($validated['appointment_id']) {
                Appointment::where('id', $validated['appointment_id'])
                    ->update(['transaction_id' => $transaction->id]);
            }

            if ($validated['reservation_id']) {
                Reservation::where('id', $validated['reservation_id'])
                    ->update(['transaction_id' => $transaction->id]);
            }

            return response()->json([
                'message' => 'Transaction created successfully',
                'transaction' => $transaction->load(['customer', 'branch', 'appointment', 'reservation']),
            ], 201);
        });
    }

    /**
     * Get all transactions for staff/admin
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        
        if (!in_array($user->role->value, ['staff', 'optometrist', 'admin'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $query = Transaction::with(['customer', 'branch', 'appointment', 'reservation']);

        // Filter by branch for staff/optometrist
        if ($user->role->value !== 'admin') {
            $query->where('branch_id', $user->branch_id);
        }

        // Apply filters
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('branch_id') && $user->role->value === 'admin') {
            $query->where('branch_id', $request->branch_id);
        }

        if ($request->has('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->has('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        $transactions = $query->orderBy('created_at', 'desc')->paginate(20);

        return response()->json([
            'transactions' => $transactions,
        ]);
    }

    /**
     * Get transaction details
     */
    public function show($id)
    {
        $user = Auth::user();
        
        if (!in_array($user->role->value, ['staff', 'optometrist', 'admin'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $transaction = Transaction::with(['customer', 'branch', 'appointment', 'reservation', 'receipt'])
            ->findOrFail($id);

        // Check branch access for staff/optometrist
        if (in_array($user->role->value, ['staff', 'optometrist']) && 
            $transaction->branch_id !== $user->branch_id) {
            return response()->json(['message' => 'Unauthorized for this branch'], 403);
        }

        return response()->json([
            'transaction' => $transaction,
        ]);
    }

    /**
     * Finalize transaction (generate receipt and mark as completed)
     */
    public function finalize(Request $request, $id)
    {
        $user = Auth::user();
        
        if (!in_array($user->role->value, ['staff', 'optometrist', 'admin'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'sales_type' => 'required|in:cash,charge',
            'customer_name' => 'required|string',
            'tin' => 'nullable|string',
            'address' => 'nullable|string',
            'eye_exam_fee' => 'required|numeric|min:0',
        ]);

        return DB::transaction(function () use ($validated, $user, $id) {
            $transaction = Transaction::with(['customer', 'branch', 'appointment', 'reservation'])
                ->findOrFail($id);

            // Check branch access for staff/optometrist
            if (in_array($user->role->value, ['staff', 'optometrist']) && 
                $transaction->branch_id !== $user->branch_id) {
                return response()->json(['message' => 'Unauthorized for this branch'], 403);
            }

            if ($transaction->status !== 'Pending') {
                return response()->json(['message' => 'Transaction is not pending'], 400);
            }

            // Check if both appointment and reservation are completed
            if ($transaction->appointment && $transaction->appointment->status !== 'completed') {
                return response()->json(['message' => 'Appointment must be completed first'], 400);
            }

            if ($transaction->reservation && $transaction->reservation->status !== 'completed') {
                return response()->json(['message' => 'Reservation must be completed first'], 400);
            }

            // Calculate totals
            $productPrice = $transaction->reservation ? 
                ($transaction->reservation->product->price * $transaction->reservation->quantity) : 0;
            $eyeExamFee = $validated['eye_exam_fee'];
            $subtotal = $productPrice + $eyeExamFee;
            
            // Calculate VAT (12%)
            $vatRate = 0.12;
            $vatableAmount = $subtotal / (1 + $vatRate);
            $vatAmount = $subtotal - $vatableAmount;

            // Create receipt
            $receipt = Receipt::create([
                'customer_id' => $transaction->customer_id,
                'branch_id' => $transaction->branch_id,
                'appointment_id' => $transaction->appointment_id,
                'sales_type' => $validated['sales_type'],
                'date' => now()->toDateString(),
                'customer_name' => $validated['customer_name'],
                'tin' => $validated['tin'] ?? null,
                'address' => $validated['address'] ?? null,
                'vatable_sales' => $vatableAmount,
                'vat_amount' => $vatAmount,
                'zero_rated_sales' => 0,
                'vat_exempt_sales' => 0,
                'net_of_vat' => $vatableAmount,
                'less_vat' => $vatAmount,
                'add_vat' => $vatAmount,
                'discount' => 0,
                'withholding_tax' => 0,
                'total_due' => $subtotal,
            ]);

            // Create receipt items
            if ($transaction->reservation) {
                $product = $transaction->reservation->product;
                $productDescription = $product->name;
                
                // Add product details to description
                if ($product->brand) {
                    $productDescription .= " - Brand: " . $product->brand;
                }
                if ($product->category) {
                    $productDescription .= " - Category: " . $product->category->name;
                }
                if ($product->model) {
                    $productDescription .= " - Model: " . $product->model;
                }
                if ($product->description) {
                    $productDescription .= " - " . $product->description;
                }
                
                $receipt->items()->create([
                    'description' => $productDescription,
                    'qty' => $transaction->reservation->quantity,
                    'unit_price' => $transaction->reservation->product->price,
                    'amount' => $productPrice,
                ]);
            }

            $receipt->items()->create([
                'description' => 'Eye Examination',
                'qty' => 1,
                'unit_price' => $eyeExamFee,
                'amount' => $eyeExamFee,
            ]);

            // Update branch stock if reservation exists
            if ($transaction->reservation) {
                $branchStock = BranchStock::where('product_id', $transaction->reservation->product_id)
                    ->where('branch_id', $transaction->branch_id)
                    ->first();

                if ($branchStock) {
                    $branchStock->decrement('quantity', $transaction->reservation->quantity);
                }
            }

            // Mark transaction as completed
            $transaction->markAsCompleted();

            // Create notifications
            $this->createNotifications($transaction->appointment, $transaction->reservation, $receipt);

            return response()->json([
                'message' => 'Transaction finalized successfully',
                'transaction' => $transaction->load(['customer', 'branch', 'appointment', 'reservation']),
                'receipt' => $receipt->load('items'),
            ], 200);
        });
    }

    /**
     * Get customer transactions
     */
    public function customerTransactions(Request $request)
    {
        $user = Auth::user();
        
        if ($user->role->value !== 'customer') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $query = Transaction::with(['branch', 'appointment', 'reservation.product'])
            ->where('customer_id', $user->id);

        // Apply filters
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->has('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        $transactions = $query->orderBy('created_at', 'desc')->paginate(20);

        return response()->json([
            'transactions' => $transactions,
        ]);
    }

    /**
     * Get patient transaction summary
     */
    public function getPatientTransactions(Request $request)
    {
        try {
            $user = Auth::user();
            
            if (!$user || !in_array($user->role->value, ['staff', 'optometrist', 'admin'])) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $query = Transaction::with([
                'customer', 
                'appointment.optometrist', 
                'reservation.product.category'
            ])
                ->where('status', 'Completed');

            // Filter by branch for staff/optometrist
            if ($user->role->value !== 'admin') {
                $query->where('branch_id', $user->branch_id);
            }

            // Apply date filter
            if ($request->has('date_from')) {
                $query->whereDate('created_at', '>=', $request->date_from);
            }

            if ($request->has('date_to')) {
                $query->whereDate('created_at', '<=', $request->date_to);
            }

            $transactions = $query->get();

            // Group by customer
            $patientData = $transactions->groupBy('customer_id')->map(function ($customerTransactions) {
                $firstTransaction = $customerTransactions->first();
                $customer = $firstTransaction->customer;
                
                // Skip if customer is null
                if (!$customer) {
                    return null;
                }
                
                return [
                    'id' => $customer->id,
                    'name' => $customer->name,
                    'email' => $customer->email,
                    'total_transactions' => $customerTransactions->count(),
                    'total_spent' => $customerTransactions->sum('total_amount'),
                    'completed_appointments' => $customerTransactions->whereNotNull('appointment_id')->count(),
                    'reserved_products' => $customerTransactions->whereNotNull('reservation_id')->count(),
                    'last_transaction_date' => $customerTransactions->max('created_at'),
                    'transactions' => $customerTransactions->sortByDesc('created_at')->values(),
                ];
            })->filter()->values()->sortByDesc('total_spent');

            return response()->json([
                'patients' => $patientData,
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in getPatientTransactions: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'message' => 'Error fetching patient transactions',
                'error' => config('app.debug') ? $e->getMessage() : 'An error occurred'
            ], 500);
        }
    }

    /**
     * Get transaction analytics for admin
     */
    public function analytics(Request $request)
    {
        $user = Auth::user();
        
        if ($user->role->value !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $dateFrom = $request->get('date_from', now()->startOfMonth());
        $dateTo = $request->get('date_to', now()->endOfMonth());
        $branchId = $request->get('branch_id');

        $query = Transaction::whereBetween('created_at', [$dateFrom, $dateTo]);

        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        $analytics = [
            'total_income' => $query->where('status', 'Completed')->sum('total_amount'),
            'total_transactions' => $query->count(),
            'completed_transactions' => $query->where('status', 'Completed')->count(),
            'pending_transactions' => $query->where('status', 'Pending')->count(),
            'cancelled_transactions' => $query->where('status', 'Cancelled')->count(),
            'average_transaction_value' => $query->where('status', 'Completed')->avg('total_amount'),
            'sales_by_branch' => $query->where('status', 'Completed')
                ->join('branches', 'transactions.branch_id', '=', 'branches.id')
                ->selectRaw('branches.name, SUM(transactions.total_amount) as total_sales')
                ->groupBy('branches.id', 'branches.name')
                ->get(),
            'sales_by_payment_method' => $query->where('status', 'Completed')
                ->selectRaw('payment_method, SUM(total_amount) as total_sales, COUNT(*) as transaction_count')
                ->groupBy('payment_method')
                ->get(),
        ];

        return response()->json([
            'analytics' => $analytics,
            'date_range' => [
                'from' => $dateFrom,
                'to' => $dateTo,
            ],
        ]);
    }


}