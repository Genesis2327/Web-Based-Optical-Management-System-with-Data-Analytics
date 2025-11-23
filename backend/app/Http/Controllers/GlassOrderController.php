<?php

namespace App\Http\Controllers;

use App\Models\GlassOrder;
use App\Models\Appointment;
use App\Models\Prescription;
use App\Models\Receipt;
use App\Models\User;
use App\Services\WebSocketService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class GlassOrderController extends Controller
{
    /**
     * Display a listing of glass orders.
     */
    public function index(Request $request)
    {
        try {
            $user = Auth::user();
            
            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }
            
            // Check if glass_orders table exists
            if (!Schema::hasTable('glass_orders')) {
                \Log::warning('glass_orders table does not exist');
                return response()->json([
                    'data' => [],
                    'message' => 'Glass orders table does not exist. Please run migrations.'
                ], 200);
            }
            
            // Try to load relationships, but handle errors gracefully
            $query = GlassOrder::query();
            
            // Try to eager load relationships if they exist
            try {
                $relationships = [];
                if (Schema::hasTable('users') && Schema::hasColumn('glass_orders', 'patient_id')) {
                    $relationships[] = 'patient';
                }
                if (Schema::hasTable('appointments') && Schema::hasColumn('glass_orders', 'appointment_id')) {
                    $relationships[] = 'appointment';
                }
                if (Schema::hasTable('prescriptions') && Schema::hasColumn('glass_orders', 'prescription_id')) {
                    $relationships[] = 'prescription';
                }
                if (Schema::hasTable('receipts') && Schema::hasColumn('glass_orders', 'receipt_id')) {
                    $relationships[] = 'receipt';
                }
                if (Schema::hasTable('branches') && Schema::hasColumn('glass_orders', 'branch_id')) {
                    $relationships[] = 'branch';
                }
                
                if (!empty($relationships)) {
                    $query->with($relationships);
                }
            } catch (\Exception $e) {
                \Log::warning('Error loading glass order relationships: ' . $e->getMessage());
                // Continue without eager loading
            }

            // Handle role format
            $userRole = null;
            if (is_object($user->role)) {
                $userRole = $user->role->value ?? (string)$user->role;
            } else {
                $userRole = (string)$user->role;
            }

            // Filter by branch for staff
            if ($userRole === 'staff') {
                if (!$user->branch_id) {
                    return response()->json(['message' => 'Staff user has no branch assigned'], 400);
                }
                if (Schema::hasColumn('glass_orders', 'branch_id')) {
                    $query->where('branch_id', $user->branch_id);
                }
            }

            // Admin can filter by branch
            if ($userRole === 'admin' && $request->has('branch_id')) {
                if (Schema::hasColumn('glass_orders', 'branch_id')) {
                    $query->where('branch_id', $request->branch_id);
                }
            }

            // Filter by status if provided
            if ($request->has('status') && Schema::hasColumn('glass_orders', 'status')) {
                $query->where('status', $request->status);
            }

            // Filter by priority if provided
            if ($request->has('priority') && Schema::hasColumn('glass_orders', 'priority')) {
                $query->where('priority', $request->priority);
            }

            // Filter by date range for admin
            if ($userRole === 'admin') {
                if ($request->has('date_from')) {
                    $query->whereDate('created_at', '>=', $request->date_from);
                }
                if ($request->has('date_to')) {
                    $query->whereDate('created_at', '<=', $request->date_to);
                }
            }

            $glassOrders = $query->orderBy('created_at', 'desc')->get();

            return response()->json([
                'data' => $glassOrders->map(function ($order) {
                    try {
                        // Safely access relationships
                        $patient = null;
                        if ($order->relationLoaded('patient') && $order->patient) {
                            $patient = [
                                'id' => $order->patient->id ?? null,
                                'name' => $order->patient->name ?? 'Unknown',
                                'email' => $order->patient->email ?? null,
                                'phone' => $order->patient->phone ?? null,
                            ];
                        }
                        
                        $appointment = null;
                        if ($order->relationLoaded('appointment') && $order->appointment) {
                            $appointment = [
                                'id' => $order->appointment->id ?? null,
                                'date' => $order->appointment->appointment_date ?? null,
                                'type' => $order->appointment->type ?? null,
                            ];
                        }
                        
                        $prescription = null;
                        if ($order->relationLoaded('prescription') && $order->prescription) {
                            $prescription = [
                                'id' => $order->prescription->id ?? null,
                                'issue_date' => $order->prescription->issue_date ?? null,
                                'expiry_date' => $order->prescription->expiry_date ?? null,
                                'prescription_data' => $order->prescription_data ?? null,
                            ];
                        }
                        
                        $receipt = null;
                        if ($order->relationLoaded('receipt') && $order->receipt) {
                            $receipt = [
                                'id' => $order->receipt->id ?? null,
                                'receipt_number' => $order->receipt->receipt_number ?? null,
                                'total_due' => $order->receipt->total_due ?? null,
                            ];
                        }
                        
                        $branch = null;
                        if ($order->relationLoaded('branch') && $order->branch) {
                            $branch = [
                                'id' => $order->branch->id ?? null,
                                'name' => $order->branch->name ?? 'Unknown',
                            ];
                        }
                        
                        return [
                            'id' => $order->id,
                            'formatted_number' => $order->formatted_number ?? ('GO-' . str_pad($order->id, 6, '0', STR_PAD_LEFT)),
                            'patient_id' => $order->patient_id ?? null,
                            'patient' => $patient,
                            'appointment' => $appointment,
                            'prescription' => $prescription,
                            'receipt' => $receipt,
                            'branch' => $branch,
                            'reserved_products' => $order->reserved_products ?? [],
                            'glass_specifications' => [
                                'frame_type' => $order->frame_type ?? null,
                                'lens_type' => $order->lens_type ?? null,
                                'lens_coating' => $order->lens_coating ?? null,
                                'blue_light_filter' => $order->blue_light_filter ?? false,
                                'progressive_lens' => $order->progressive_lens ?? false,
                                'bifocal_lens' => $order->bifocal_lens ?? false,
                                'lens_material' => $order->lens_material ?? null,
                                'frame_material' => $order->frame_material ?? null,
                                'frame_color' => $order->frame_color ?? null,
                                'lens_color' => $order->lens_color ?? null,
                            ],
                            'manufacturer_info' => [
                                'special_instructions' => $order->special_instructions ?? null,
                                'manufacturer_notes' => $order->manufacturer_notes ?? null,
                                'priority' => $order->priority ?? 'normal',
                            ],
                            'status' => $order->status ?? 'pending',
                            'staff_notes' => $order->staff_notes ?? null,
                            'status_history' => $order->status_history ?? [],
                            'sent_to_manufacturer_at' => $order->sent_to_manufacturer_at ? $order->sent_to_manufacturer_at->toISOString() : null,
                            'expected_delivery_date' => $order->expected_delivery_date ? $order->expected_delivery_date->toISOString() : null,
                            'manufacturer_feedback' => $order->manufacturer_feedback ?? null,
                            'created_at' => $order->created_at ? $order->created_at->toISOString() : now()->toISOString(),
                            'updated_at' => $order->updated_at ? $order->updated_at->toISOString() : now()->toISOString(),
                        ];
                    } catch (\Exception $e) {
                        \Log::error('Error mapping glass order: ' . $e->getMessage(), [
                            'order_id' => $order->id ?? null,
                            'trace' => $e->getTraceAsString()
                        ]);
                        // Return minimal data if mapping fails
                        return [
                            'id' => $order->id ?? null,
                            'formatted_number' => $order->formatted_number ?? 'N/A',
                            'patient_id' => $order->patient_id ?? null,
                            'status' => $order->status ?? 'unknown',
                            'error' => 'Error loading order details'
                        ];
                    }
                })
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in GlassOrderController@index: ' . $e->getMessage());
            \Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json([
                'message' => 'An error occurred while fetching glass orders',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Store a newly created glass order.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'appointment_id' => 'required|exists:appointments,id',
            'patient_id' => 'required|exists:users,id',
            'prescription_id' => 'nullable|exists:prescriptions,id',
            'receipt_id' => 'nullable|exists:receipts,id',
            'reserved_products' => 'required|array',
            'prescription_data' => 'nullable|array',
            'frame_type' => 'nullable|string',
            'lens_type' => 'nullable|string',
            'lens_coating' => 'nullable|string',
            'blue_light_filter' => 'boolean',
            'progressive_lens' => 'boolean',
            'bifocal_lens' => 'boolean',
            'lens_material' => 'nullable|string',
            'frame_material' => 'nullable|string',
            'frame_color' => 'nullable|string',
            'lens_color' => 'nullable|string',
            'special_instructions' => 'nullable|string',
            'manufacturer_notes' => 'nullable|string',
            'priority' => 'in:low,normal,high,urgent',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = Auth::user();
        
        // Get appointment to determine branch
        $appointment = Appointment::findOrFail($request->appointment_id);
        
        $glassOrder = GlassOrder::create([
            'appointment_id' => $request->appointment_id,
            'patient_id' => $request->patient_id,
            'prescription_id' => $request->prescription_id,
            'receipt_id' => $request->receipt_id,
            'branch_id' => $appointment->branch_id,
            'reserved_products' => $request->reserved_products,
            'prescription_data' => $request->prescription_data,
            'frame_type' => $request->frame_type,
            'lens_type' => $request->lens_type,
            'lens_coating' => $request->lens_coating,
            'blue_light_filter' => $request->blue_light_filter ?? false,
            'progressive_lens' => $request->progressive_lens ?? false,
            'bifocal_lens' => $request->bifocal_lens ?? false,
            'lens_material' => $request->lens_material,
            'frame_material' => $request->frame_material,
            'frame_color' => $request->frame_color,
            'lens_color' => $request->lens_color,
            'special_instructions' => $request->special_instructions,
            'manufacturer_notes' => $request->manufacturer_notes,
            'priority' => $request->priority ?? 'normal',
            'status' => 'Pending Confirmation',
        ]);

        // Notify staff members in the branch about new order
        try {
            WebSocketService::notifyBranch(
                'New Product Order Created',
                "New product order {$glassOrder->formatted_number} has been created for patient {$glassOrder->patient->name}.",
                $appointment->branch_id,
                'product_order',
                [
                    'order_id' => $glassOrder->id,
                    'order_number' => $glassOrder->formatted_number,
                    'patient_id' => $glassOrder->patient_id,
                    'status' => $glassOrder->status,
                ]
            );
        } catch (\Exception $e) {
            Log::error('Failed to send notification for new glass order: ' . $e->getMessage());
        }

        return response()->json([
            'message' => 'Glass order created successfully',
            'data' => [
                'id' => $glassOrder->id,
                'formatted_number' => $glassOrder->formatted_number,
                'status' => $glassOrder->status,
            ]
        ], 201);
    }

    /**
     * Display the specified glass order.
     */
    public function show($id)
    {
        $user = Auth::user();
        $glassOrder = GlassOrder::with(['patient', 'appointment', 'prescription', 'receipt', 'branch'])->findOrFail($id);

        // Check if user has access to this order
        if ($user->role->value === 'staff' && $glassOrder->branch_id !== $user->branch_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return response()->json([
            'data' => [
                'id' => $glassOrder->id,
                'formatted_number' => $glassOrder->formatted_number,
                'patient' => [
                    'id' => $glassOrder->patient->id,
                    'name' => $glassOrder->patient->name,
                    'email' => $glassOrder->patient->email,
                    'phone' => $glassOrder->patient->phone,
                    'address' => $glassOrder->patient->address,
                ],
                'appointment' => [
                    'id' => $glassOrder->appointment->id,
                    'date' => $glassOrder->appointment->appointment_date,
                    'type' => $glassOrder->appointment->type,
                ],
                'prescription' => $glassOrder->prescription ? [
                    'id' => $glassOrder->prescription->id,
                    'right_eye' => $glassOrder->prescription->right_eye,
                    'left_eye' => $glassOrder->prescription->left_eye,
                    'lens_type' => $glassOrder->prescription->lens_type,
                    'coating' => $glassOrder->prescription->coating,
                    'recommendations' => $glassOrder->prescription->recommendations,
                    'additional_notes' => $glassOrder->prescription->additional_notes,
                ] : null,
                'reserved_products' => $glassOrder->reserved_products,
                'prescription_data' => $glassOrder->prescription_data,
                'glass_specifications' => [
                    'frame_type' => $glassOrder->frame_type,
                    'lens_type' => $glassOrder->lens_type,
                    'lens_coating' => $glassOrder->lens_coating,
                    'blue_light_filter' => $glassOrder->blue_light_filter,
                    'progressive_lens' => $glassOrder->progressive_lens,
                    'bifocal_lens' => $glassOrder->bifocal_lens,
                    'lens_material' => $glassOrder->lens_material,
                    'frame_material' => $glassOrder->frame_material,
                    'frame_color' => $glassOrder->frame_color,
                    'lens_color' => $glassOrder->lens_color,
                ],
                'manufacturer_info' => [
                    'special_instructions' => $glassOrder->special_instructions,
                    'manufacturer_notes' => $glassOrder->manufacturer_notes,
                    'priority' => $glassOrder->priority,
                ],
                'status' => $glassOrder->status,
                'staff_notes' => $glassOrder->staff_notes,
                'status_history' => $glassOrder->status_history,
                'available_next_statuses' => $glassOrder->getAvailableNextStatuses(),
                'sent_to_manufacturer_at' => $glassOrder->sent_to_manufacturer_at,
                'expected_delivery_date' => $glassOrder->expected_delivery_date,
                'manufacturer_feedback' => $glassOrder->manufacturer_feedback,
                'created_at' => $glassOrder->created_at->toISOString(),
                'updated_at' => $glassOrder->updated_at->toISOString(),
            ]
        ]);
    }

    /**
     * Update the specified glass order.
     */
    public function update(Request $request, $id)
    {
        $user = Auth::user();
        $glassOrder = GlassOrder::findOrFail($id);

        // Check if user has access to this order
        if ($user->role->value === 'staff' && $glassOrder->branch_id !== $user->branch_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'status' => 'in:Pending Confirmation,For Manufacturing,In Production,Assembly / Quality Check,Ready for Pickup,Delivered,Cancelled',
            'priority' => 'in:low,normal,high,urgent',
            'expected_delivery_date' => 'nullable|date',
            'manufacturer_feedback' => 'nullable|string',
            'staff_notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $updateData = $request->only([
            'priority', 'expected_delivery_date', 'manufacturer_feedback', 'staff_notes'
        ]);

        // If status is being updated, use the updateStatus method to track history
        if ($request->has('status') && $request->status !== $glassOrder->status) {
            $glassOrder->updateStatus(
                $request->status,
                $request->status_notes ?? null,
                $user->id
            );
            
            // Notify customer about status change
            try {
                WebSocketService::notifyUsers(
                    'Order Status Updated',
                    "Your order {$glassOrder->formatted_number} status has been updated to: {$request->status}",
                    'product_order',
                    [$glassOrder->patient_id],
                    [
                        'order_id' => $glassOrder->id,
                        'order_number' => $glassOrder->formatted_number,
                        'status' => $request->status,
                        'previous_status' => $glassOrder->getOriginal('status'),
                    ]
                );
            } catch (\Exception $e) {
                Log::error('Failed to send status update notification: ' . $e->getMessage());
            }
        } else {
            $glassOrder->update($updateData);
        }

        // If status is being updated to 'For Manufacturing', set the timestamp
        if ($request->has('status') && $request->status === 'For Manufacturing') {
            $glassOrder->update(['sent_to_manufacturer_at' => now()]);
        }

        return response()->json([
            'message' => 'Glass order updated successfully',
            'data' => [
                'id' => $glassOrder->id,
                'status' => $glassOrder->status,
                'staff_notes' => $glassOrder->staff_notes,
                'updated_at' => $glassOrder->updated_at->toISOString(),
            ]
        ]);
    }

    /**
     * Get glass orders for a specific patient.
     */
    public function getByPatient($patientId)
    {
        try {
            $user = Auth::user();
            
            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }
            
            // Handle role format
            $userRole = null;
            if (isset($user->role)) {
                if (is_object($user->role)) {
                    $userRole = $user->role->value ?? (string)$user->role;
                } else {
                    $userRole = (string)$user->role;
                }
            }

            // Check authorization - customer can only see their own orders
            if ($userRole === 'customer' && $user->id != $patientId) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Check if glass_orders table exists
            if (!Schema::hasTable('glass_orders')) {
                return response()->json([
                    'data' => [],
                    'message' => 'Glass orders table does not exist. Please run migrations.'
                ], 200);
            }

            // Build query safely
            $hasDeletedAt = Schema::hasColumn('glass_orders', 'deleted_at');
            $query = GlassOrder::where('patient_id', $patientId);
            
            // Disable soft deletes scope if deleted_at column doesn't exist
            if (!$hasDeletedAt) {
                $query->withoutGlobalScopes();
            }

            // Filter by branch for staff
            if ($userRole === 'staff' && isset($user->branch_id)) {
                $query->where('branch_id', $user->branch_id);
            }

            // Load relationships safely
            $withRelations = [];
            try {
                if (Schema::hasTable('users') && Schema::hasColumn('glass_orders', 'patient_id')) {
                    $withRelations[] = 'patient';
                }
            } catch (\Exception $e) {
                \Log::warning('Could not load patient relationship: ' . $e->getMessage());
            }
            
            try {
                if (Schema::hasTable('appointments') && Schema::hasColumn('glass_orders', 'appointment_id')) {
                    $withRelations[] = 'appointment';
                }
            } catch (\Exception $e) {
                \Log::warning('Could not load appointment relationship: ' . $e->getMessage());
            }
            
            try {
                if (Schema::hasTable('prescriptions') && Schema::hasColumn('glass_orders', 'prescription_id')) {
                    $withRelations[] = 'prescription';
                }
            } catch (\Exception $e) {
                \Log::warning('Could not load prescription relationship: ' . $e->getMessage());
            }
            
            try {
                if (Schema::hasTable('receipts') && Schema::hasColumn('glass_orders', 'receipt_id')) {
                    $withRelations[] = 'receipt';
                }
            } catch (\Exception $e) {
                \Log::warning('Could not load receipt relationship: ' . $e->getMessage());
            }
            
            try {
                if (Schema::hasTable('branches') && Schema::hasColumn('glass_orders', 'branch_id')) {
                    $withRelations[] = 'branch';
                }
            } catch (\Exception $e) {
                \Log::warning('Could not load branch relationship: ' . $e->getMessage());
            }

            if (count($withRelations) > 0) {
                $query->with($withRelations);
            }

            $glassOrders = $query->orderBy('created_at', 'desc')->get();

            return response()->json([
                'data' => $glassOrders->map(function ($order) {
                    try {
                        // Safely get patient data
                        $patientData = null;
                        if ($order->patient) {
                            $patientData = [
                                'id' => $order->patient->id ?? null,
                                'name' => $order->patient->name ?? null,
                                'email' => $order->patient->email ?? null,
                                'phone' => $order->patient->phone ?? null,
                            ];
                        }

                        // Safely get appointment data
                        $appointmentData = null;
                        if ($order->appointment) {
                            $appointmentData = [
                                'id' => $order->appointment->id ?? null,
                                'date' => $order->appointment->appointment_date ?? null,
                                'type' => $order->appointment->type ?? null,
                            ];
                        }

                        // Safely get prescription data
                        $prescriptionData = null;
                        if ($order->prescription) {
                            $prescriptionData = [
                                'id' => $order->prescription->id ?? null,
                                'lens_type' => $order->prescription->lens_type ?? null,
                                'coating' => $order->prescription->coating ?? null,
                                'prescription_data' => $order->prescription_data ?? null,
                            ];
                        }

                        // Safely get receipt data
                        $receiptData = null;
                        if ($order->receipt) {
                            $receiptData = [
                                'id' => $order->receipt->id ?? null,
                                'receipt_number' => $order->receipt->receipt_number ?? null,
                                'total_due' => $order->receipt->total_due ?? null,
                            ];
                        }

                        // Safely get branch data
                        $branchData = null;
                        if ($order->branch) {
                            $branchData = [
                                'id' => $order->branch->id ?? null,
                                'name' => $order->branch->name ?? null,
                            ];
                        }

                        return [
                            'id' => $order->id ?? null,
                            'formatted_number' => $order->formatted_number ?? 'GO-' . str_pad($order->id ?? 0, 6, '0', STR_PAD_LEFT),
                            'patient' => $patientData,
                            'appointment' => $appointmentData,
                            'prescription' => $prescriptionData,
                            'receipt' => $receiptData,
                            'branch' => $branchData,
                            'reserved_products' => $order->reserved_products ?? [],
                            'glass_specifications' => [
                                'frame_type' => $order->frame_type ?? null,
                                'lens_type' => $order->lens_type ?? null,
                                'lens_coating' => $order->lens_coating ?? null,
                                'blue_light_filter' => $order->blue_light_filter ?? false,
                                'progressive_lens' => $order->progressive_lens ?? false,
                                'bifocal_lens' => $order->bifocal_lens ?? false,
                                'lens_material' => $order->lens_material ?? null,
                                'frame_material' => $order->frame_material ?? null,
                                'frame_color' => $order->frame_color ?? null,
                                'lens_color' => $order->lens_color ?? null,
                            ],
                            'manufacturer_info' => [
                                'special_instructions' => $order->special_instructions ?? null,
                                'manufacturer_notes' => $order->manufacturer_notes ?? null,
                                'priority' => $order->priority ?? null,
                            ],
                            'status' => $order->status ?? 'Pending Confirmation',
                            'staff_notes' => $order->staff_notes ?? null,
                            'status_history' => $order->status_history ?? [],
                            'sent_to_manufacturer_at' => $order->sent_to_manufacturer_at ? $order->sent_to_manufacturer_at->toISOString() : null,
                            'expected_delivery_date' => $order->expected_delivery_date ? $order->expected_delivery_date->toISOString() : null,
                            'manufacturer_feedback' => $order->manufacturer_feedback ?? null,
                            'created_at' => $order->created_at ? $order->created_at->toISOString() : null,
                            'updated_at' => $order->updated_at ? $order->updated_at->toISOString() : null,
                        ];
                    } catch (\Exception $e) {
                        \Log::warning('Error formatting glass order in getByPatient: ' . $e->getMessage());
                        return [
                            'id' => $order->id ?? null,
                            'formatted_number' => 'GO-' . str_pad($order->id ?? 0, 6, '0', STR_PAD_LEFT),
                            'patient' => null,
                            'appointment' => null,
                            'prescription' => null,
                            'receipt' => null,
                            'branch' => null,
                            'reserved_products' => [],
                            'glass_specifications' => [],
                            'manufacturer_info' => [],
                            'status' => 'Unknown',
                            'staff_notes' => null,
                            'status_history' => [],
                            'sent_to_manufacturer_at' => null,
                            'expected_delivery_date' => null,
                            'manufacturer_feedback' => null,
                            'created_at' => null,
                            'updated_at' => null,
                        ];
                    }
                })
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in GlassOrderController@getByPatient: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'patient_id' => $patientId,
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
            
            return response()->json([
                'message' => 'Error fetching glass orders',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error',
                'data' => []
            ], 500);
        }
    }

    /**
     * Mark glass order as sent to manufacturer.
     */
    public function markAsSentToManufacturer($id)
    {
        $user = Auth::user();
        $glassOrder = GlassOrder::findOrFail($id);

        // Check if user has access to this order
        if ($user->role->value === 'staff' && $glassOrder->branch_id !== $user->branch_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $glassOrder->markAsSentToManufacturer();

        return response()->json([
            'message' => 'Glass order marked as sent to manufacturer',
            'data' => [
                'id' => $glassOrder->id,
                'status' => $glassOrder->status,
                'sent_to_manufacturer_at' => $glassOrder->sent_to_manufacturer_at->toISOString(),
            ]
        ]);
    }

    /**
     * Update order status with notifications.
     */
    public function updateStatus(Request $request, $id)
    {
        $user = Auth::user();
        $glassOrder = GlassOrder::findOrFail($id);

        // Check if user has access to this order
        $userRole = is_object($user->role) ? $user->role->value : (string)$user->role;
        if ($userRole === 'staff' && $glassOrder->branch_id !== $user->branch_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Only staff and admin can update status
        if (!in_array($userRole, ['staff', 'admin'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'status' => 'required|in:Pending Confirmation,For Manufacturing,In Production,Assembly / Quality Check,Ready for Pickup,Delivered,Cancelled',
            'notes' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Check if status transition is valid
        $availableStatuses = $glassOrder->getAvailableNextStatuses();
        if (!in_array($request->status, $availableStatuses)) {
            return response()->json([
                'message' => 'Invalid status transition',
                'available_statuses' => $availableStatuses
            ], 422);
        }

        $oldStatus = $glassOrder->status;
        $glassOrder->updateStatus($request->status, $request->notes, $user->id);

        // If status is 'For Manufacturing', set timestamp
        if ($request->status === 'For Manufacturing') {
            $glassOrder->update(['sent_to_manufacturer_at' => now()]);
        }

        // Notify customer about status change
        try {
            $notificationMessage = "Your order {$glassOrder->formatted_number} status has been updated to: {$request->status}";
            if ($request->status === 'Ready for Pickup') {
                $notificationMessage = "Great news! Your order {$glassOrder->formatted_number} is ready for pickup at {$glassOrder->branch->name}.";
            }

            WebSocketService::notifyUsers(
                'Order Status Updated',
                $notificationMessage,
                'product_order',
                [$glassOrder->patient_id],
                [
                    'order_id' => $glassOrder->id,
                    'order_number' => $glassOrder->formatted_number,
                    'status' => $request->status,
                    'previous_status' => $oldStatus,
                    'branch_name' => $glassOrder->branch->name ?? null,
                ]
            );
        } catch (\Exception $e) {
            Log::error('Failed to send status update notification: ' . $e->getMessage());
        }

        return response()->json([
            'message' => 'Order status updated successfully',
            'data' => [
                'id' => $glassOrder->id,
                'status' => $glassOrder->status,
                'status_history' => $glassOrder->status_history,
            ]
        ]);
    }

    /**
     * Update staff notes for an order.
     */
    public function updateStaffNotes(Request $request, $id)
    {
        $user = Auth::user();
        $glassOrder = GlassOrder::findOrFail($id);

        // Check if user has access to this order
        $userRole = is_object($user->role) ? $user->role->value : (string)$user->role;
        if ($userRole === 'staff' && $glassOrder->branch_id !== $user->branch_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Only staff and admin can update notes
        if (!in_array($userRole, ['staff', 'admin'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'staff_notes' => 'required|string|max:2000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $glassOrder->update(['staff_notes' => $request->staff_notes]);

        return response()->json([
            'message' => 'Staff notes updated successfully',
            'data' => [
                'id' => $glassOrder->id,
                'staff_notes' => $glassOrder->staff_notes,
            ]
        ]);
    }
}