<?php

namespace App\Http\Controllers;

use App\Models\Feedback;
use App\Models\Appointment;
use App\Models\User;
use App\Models\Branch;
use App\Models\OptometristRotation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;
use Carbon\Carbon;

class FeedbackController extends Controller
{
    /**
     * Submit feedback for a completed appointment
     */
    public function store(Request $request)
    {
        $user = $request->user();
        
        // Handle different role formats
        $userRole = null;
        if (is_object($user->role)) {
            $userRole = $user->role->value ?? (string)$user->role;
        } else {
            $userRole = (string)$user->role;
        }

        // Only customers can submit feedback
        if ($userRole !== 'customer') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Log the incoming request for debugging
        \Log::info('Feedback submission request', [
            'user_id' => $user->id,
            'request_data' => $request->all(),
            'headers' => $request->headers->all()
        ]);

        $validator = Validator::make($request->all(), [
            'appointment_id' => 'required|integer|exists:appointments,id',
            'rating' => 'required|integer|min:1|max:5',
            'comment' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            \Log::warning('Feedback validation failed', [
                'errors' => $validator->errors()->toArray(),
                'request_data' => $request->all()
            ]);
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            // Check if appointment belongs to the customer and is completed
            $appointment = Appointment::where('id', $request->appointment_id)
                ->where('patient_id', $user->id)
                ->where('status', 'completed')
                ->first();

            if (!$appointment) {
                return response()->json([
                    'message' => 'Appointment not found or not completed'
                ], 404);
            }

            // Try to get branch_id from appointment, or from optometrist rotation schedule
            $branchId = $appointment->branch_id;
            
            if (!$branchId && $appointment->optometrist_id && $appointment->appointment_date) {
                // Try to get branch_id from optometrist rotation schedule
                try {
                    $date = \Carbon\Carbon::parse($appointment->appointment_date);
                    $dayOfWeek = $date->dayOfWeekIso; // 1 = Monday, 7 = Sunday
                    
                    $rotation = OptometristRotation::where('optometrist_id', $appointment->optometrist_id)
                        ->where('is_active', true)
                        ->first();
                    
                    if ($rotation) {
                        foreach ($rotation->rotation_schedule as $schedule) {
                            if ($schedule['day'] === $dayOfWeek) {
                                $branchId = $schedule['branch_id'];
                                // Update the appointment with the branch_id for future reference
                                $appointment->update(['branch_id' => $branchId]);
                                \Log::info('Auto-assigned branch_id to appointment from rotation schedule', [
                                    'appointment_id' => $appointment->id,
                                    'branch_id' => $branchId
                                ]);
                                break;
                            }
                        }
                    }
                } catch (\Exception $e) {
                    \Log::warning('Failed to auto-assign branch_id from rotation schedule', [
                        'appointment_id' => $appointment->id,
                        'error' => $e->getMessage()
                    ]);
                }
            }
            
            // If still no branch_id, return error
            if (!$branchId) {
                \Log::error('Appointment missing branch_id and unable to determine from rotation', [
                    'appointment_id' => $appointment->id,
                    'user_id' => $user->id,
                    'optometrist_id' => $appointment->optometrist_id,
                    'appointment_date' => $appointment->appointment_date,
                    'appointment_data' => $appointment->toArray()
                ]);
                return response()->json([
                    'message' => 'Appointment is missing branch information. Please contact support.',
                    'error' => 'MISSING_BRANCH_ID',
                    'appointment_id' => $appointment->id
                ], 400);
            }

            // Check if feedback already exists for this appointment
            $existingFeedback = Feedback::where('customer_id', $user->id)
                ->where('appointment_id', $request->appointment_id)
                ->first();

            if ($existingFeedback) {
                return response()->json([
                    'message' => 'Feedback already submitted for this appointment'
                ], 409);
            }

            // Create feedback
            $feedback = Feedback::create([
                'customer_id' => $user->id,
                'branch_id' => $branchId,
                'appointment_id' => $request->appointment_id,
                'rating' => $request->rating,
                'comment' => $request->comment,
            ]);

            return response()->json([
                'message' => 'Feedback submitted successfully',
                'feedback' => $feedback->load(['branch', 'appointment'])
            ], 201);
        } catch (\Exception $e) {
            \Log::error('Error submitting feedback: ' . $e->getMessage(), [
                'user_id' => $user->id,
                'appointment_id' => $request->appointment_id,
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'message' => 'An error occurred while submitting feedback',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Get customer's feedback history
     */
    public function getByCustomer(Request $request, $customerId)
    {
        try {
            $user = $request->user();
            $userRole = $user->role->value ?? (string)$user->role;

            // Only customers can view their own feedback, or staff/admin can view any
            if ($userRole === 'customer' && $user->id != $customerId) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            if (!in_array($userRole, ['customer', 'staff', 'admin'])) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $feedback = Feedback::where('customer_id', $customerId)
                ->with(['branch', 'appointment.optometrist'])
                ->orderBy('created_at', 'desc')
                ->get()
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'appointment_id' => $item->appointment_id,
                        'rating' => $item->rating,
                        'comment' => $item->comment,
                        'created_at' => $item->created_at->toISOString(),
                        'appointment' => $item->appointment ? [
                            'id' => $item->appointment->id,
                            'appointment_date' => $item->appointment->appointment_date,
                            'appointment_time' => $item->appointment->start_time,
                            'appointment_type' => $item->appointment->type,
                            'optometrist' => $item->appointment->optometrist ? [
                                'id' => $item->appointment->optometrist->id,
                                'name' => $item->appointment->optometrist->name,
                            ] : null,
                        ] : null,
                        'branch' => $item->branch ? [
                            'id' => $item->branch->id,
                            'name' => $item->branch->name,
                        ] : null,
                    ];
                });

            return response()->json([
                'data' => $feedback,
                'count' => $feedback->count()
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in getByCustomer: ' . $e->getMessage());
            return response()->json([
                'message' => 'An error occurred while fetching feedback',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get customer's feedback history
     */
    public function getCustomerFeedback(Request $request, $customerId)
    {
        $user = $request->user();
        
        // Handle different role formats
        $userRole = null;
        if (is_object($user->role)) {
            $userRole = $user->role->value ?? (string)$user->role;
        } else {
            $userRole = (string)$user->role;
        }

        // Only customers can view their own feedback, or staff/admin can view any
        if ($userRole === 'customer' && $user->id != $customerId) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if (!in_array($userRole, ['customer', 'staff', 'admin'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $feedback = Feedback::where('customer_id', $customerId)
            ->with(['branch', 'appointment.optometrist'])
            ->orderBy('created_at', 'desc')
            ->paginate(15);

        return response()->json([
            'data' => $feedback->items(),
            'pagination' => [
                'current_page' => $feedback->currentPage(),
                'last_page' => $feedback->lastPage(),
                'per_page' => $feedback->perPage(),
                'total' => $feedback->total(),
            ]
        ]);
    }

    /**
     * Get feedback analytics for admin
     */
    public function getAnalytics(Request $request)
    {
        try {
            $user = $request->user();
            
            \Log::info('Feedback Analytics Debug:', [
                'user' => $user ? [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role ? (is_object($user->role) ? $user->role->value : $user->role) : 'NULL'
                ] : 'NULL',
                'headers' => $request->headers->all(),
                'token' => $request->bearerToken()
            ]);
            
            if (!$user) {
                \Log::error('Feedback Analytics: No authenticated user');
                return response()->json(['message' => 'Unauthorized'], 401);
            }
            
            // Handle different role formats
            $userRole = null;
            if ($user->role) {
                if (is_object($user->role)) {
                    $userRole = $user->role->value ?? (string)$user->role;
                } else {
                    $userRole = (string)$user->role;
                }
            }

            \Log::info('Feedback Analytics: User role determined', ['userRole' => $userRole]);

            // Only admin can access analytics
            if ($userRole !== 'admin') {
                \Log::error('Feedback Analytics: User is not admin', ['userRole' => $userRole]);
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Check if feedback table exists
            if (!Schema::hasTable('feedback')) {
                \Log::warning('Feedback Analytics: feedback table does not exist');
                return response()->json([
                    'branch_ratings' => [],
                    'overall_stats' => [
                        'avg_rating' => 0,
                        'total_feedback' => 0,
                        'unique_customers' => 0,
                    ],
                    'trend_data' => [],
                    'latest_feedback' => [],
                    'rating_distribution' => [],
                    'filters' => [
                        'start_date' => $request->get('start_date') ?? Carbon::now()->subMonths(6)->format('Y-m-d'),
                        'end_date' => $request->get('end_date') ?? Carbon::now()->format('Y-m-d'),
                        'branch_id' => $request->get('branch_id'),
                    ],
                    'message' => 'Feedback table does not exist. Please run migrations.'
                ], 200);
            }

            // Check if required columns exist
            $requiredColumns = ['created_at', 'rating', 'customer_id', 'branch_id'];
            $missingColumns = [];
            foreach ($requiredColumns as $column) {
                if (!Schema::hasColumn('feedback', $column)) {
                    $missingColumns[] = $column;
                }
            }

            if (!empty($missingColumns)) {
                \Log::warning('Feedback Analytics: Missing columns in feedback table', ['missing_columns' => $missingColumns]);
                $branchId = $request->get('branch_id');
                return response()->json([
                    'branch_ratings' => [],
                    'overall_stats' => [
                        'avg_rating' => 0,
                        'total_feedback' => 0,
                        'unique_customers' => 0,
                    ],
                    'trend_data' => [],
                    'latest_feedback' => [],
                    'rating_distribution' => [],
                    'filters' => [
                        'start_date' => $request->get('start_date') ?? Carbon::now()->subMonths(6)->format('Y-m-d'),
                        'end_date' => $request->get('end_date') ?? Carbon::now()->format('Y-m-d'),
                        'branch_id' => $branchId,
                    ],
                    'message' => 'Feedback table is missing required columns: ' . implode(', ', $missingColumns)
                ], 200);
            }

            $branchId = $request->get('branch_id');
            
            // Parse dates and set to start/end of day for proper datetime comparison
            try {
                $startDate = $request->get('start_date') 
                    ? Carbon::parse($request->get('start_date'))->startOfDay()
                    : Carbon::now()->subMonths(6)->startOfDay();
                $endDate = $request->get('end_date')
                    ? Carbon::parse($request->get('end_date'))->endOfDay()
                    : Carbon::now()->endOfDay();
            } catch (\Exception $e) {
                \Log::error('Feedback Analytics: Error parsing dates', ['error' => $e->getMessage()]);
                $startDate = Carbon::now()->subMonths(6)->startOfDay();
                $endDate = Carbon::now()->endOfDay();
            }

            \Log::info('Feedback Analytics Query Params', [
                'startDate' => $startDate->toDateTimeString(),
                'endDate' => $endDate->toDateTimeString(),
                'branchId' => $branchId,
            ]);
            
            // Check if we can query the feedback table
            try {
                $totalFeedback = Feedback::count();
                \Log::info('Feedback Analytics: Total feedback count', ['count' => $totalFeedback]);
            } catch (\Exception $e) {
                \Log::error('Feedback Analytics: Error counting feedback', ['error' => $e->getMessage()]);
                return response()->json([
                    'branch_ratings' => [],
                    'overall_stats' => [
                        'avg_rating' => 0,
                        'total_feedback' => 0,
                        'unique_customers' => 0,
                    ],
                    'trend_data' => [],
                    'latest_feedback' => [],
                    'rating_distribution' => [],
                    'filters' => [
                        'start_date' => $startDate->format('Y-m-d'),
                        'end_date' => $endDate->format('Y-m-d'),
                        'branch_id' => $branchId,
                    ],
                    'message' => 'Error querying feedback table: ' . $e->getMessage()
                ], 200);
            }
            
            // Log feedback count after date filter
            try {
                $totalInRange = Feedback::whereBetween('created_at', [$startDate, $endDate])->count();
                \Log::info('Feedback Analytics: Total feedback in date range', ['count' => $totalInRange]);
            } catch (\Exception $e) {
                \Log::warning('Feedback Analytics: Error counting feedback in date range', ['error' => $e->getMessage()]);
                $totalInRange = 0;
            }

            // Get average rating per branch
            $branchRatings = [];
            try {
                $query = Feedback::whereBetween('created_at', [$startDate, $endDate]);
                
                // Load branch relationship only if branches table exists
                if (Schema::hasTable('branches') && Schema::hasColumn('feedback', 'branch_id')) {
                    try {
                        $query->with('branch');
                    } catch (\Exception $e) {
                        \Log::warning('Feedback Analytics: Could not load branch relationship', ['error' => $e->getMessage()]);
                    }
                }
                
                if ($branchId) {
                    $query->where('branch_id', $branchId);
                }
                
                $branchRatings = $query->select('branch_id', DB::raw('AVG(rating) as avg_rating'), DB::raw('COUNT(*) as feedback_count'))
                    ->groupBy('branch_id')
                    ->get()
                    ->map(function ($item) {
                        try {
                            return [
                                'branch_id' => $item->branch_id ?? null,
                                'branch_name' => $item->branch->name ?? 'Unknown',
                                'avg_rating' => round($item->avg_rating ?? 0, 2),
                                'feedback_count' => $item->feedback_count ?? 0,
                            ];
                        } catch (\Exception $e) {
                            \Log::warning('Feedback Analytics: Error formatting branch rating', ['error' => $e->getMessage()]);
                            return [
                                'branch_id' => $item->branch_id ?? null,
                                'branch_name' => 'Unknown',
                                'avg_rating' => 0,
                                'feedback_count' => 0,
                            ];
                        }
                    })->toArray();
            } catch (\Exception $e) {
                \Log::error('Feedback Analytics: Error getting branch ratings', ['error' => $e->getMessage()]);
                $branchRatings = [];
            }

            // Get overall statistics
            $overallStats = (object)[
                'overall_avg_rating' => 0,
                'total_feedback' => 0,
                'unique_customers' => 0,
            ];
            try {
                $query = Feedback::whereBetween('created_at', [$startDate, $endDate]);
                if ($branchId) {
                    $query->where('branch_id', $branchId);
                }
                $stats = $query->select(
                    DB::raw('AVG(rating) as overall_avg_rating'),
                    DB::raw('COUNT(*) as total_feedback'),
                    DB::raw('COUNT(DISTINCT customer_id) as unique_customers')
                )->first();
                
                if ($stats) {
                    $overallStats = $stats;
                }
            } catch (\Exception $e) {
                \Log::error('Feedback Analytics: Error getting overall stats', ['error' => $e->getMessage()]);
            }

            // Get trend over time (monthly)
            $trendData = [];
            try {
                $query = Feedback::whereBetween('created_at', [$startDate, $endDate]);
                if ($branchId) {
                    $query->where('branch_id', $branchId);
                }
                $trendData = $query->select(
                    DB::raw('DATE_FORMAT(created_at, "%Y-%m") as month'),
                    DB::raw('AVG(rating) as avg_rating'),
                    DB::raw('COUNT(*) as feedback_count')
                )
                ->groupBy('month')
                ->orderBy('month')
                ->get()
                ->toArray();
            } catch (\Exception $e) {
                \Log::error('Feedback Analytics: Error getting trend data', ['error' => $e->getMessage()]);
                $trendData = [];
            }

            // Get latest feedback with comments
            $latestFeedback = [];
            try {
                $query = Feedback::whereBetween('created_at', [$startDate, $endDate]);
                
                // Load relationships only if tables exist
                $withRelations = [];
                if (Schema::hasTable('users') && Schema::hasColumn('feedback', 'customer_id')) {
                    $withRelations[] = 'customer';
                }
                if (Schema::hasTable('branches') && Schema::hasColumn('feedback', 'branch_id')) {
                    $withRelations[] = 'branch';
                }
                if (Schema::hasTable('appointments') && Schema::hasColumn('feedback', 'appointment_id')) {
                    $withRelations[] = 'appointment';
                }
                
                if (!empty($withRelations)) {
                    $query->with($withRelations);
                }
                
                if ($branchId) {
                    $query->where('branch_id', $branchId);
                }
                
                $latestFeedback = $query->orderBy('created_at', 'desc')
                    ->limit(20)
                    ->get()
                    ->map(function ($feedback) {
                        try {
                            return [
                                'id' => $feedback->id ?? null,
                                'customer_name' => $feedback->customer?->name ?? 'Unknown Customer',
                                'branch_name' => $feedback->branch?->name ?? 'Unknown Branch',
                                'rating' => $feedback->rating ?? 0,
                                'comment' => $feedback->comment ?? null,
                                'appointment_date' => $feedback->appointment?->appointment_date ?? null,
                                'created_at' => $feedback->created_at ?? null,
                            ];
                        } catch (\Exception $e) {
                            \Log::warning('Feedback Analytics: Error formatting latest feedback', ['error' => $e->getMessage()]);
                            return [
                                'id' => $feedback->id ?? null,
                                'customer_name' => 'Unknown Customer',
                                'branch_name' => 'Unknown Branch',
                                'rating' => 0,
                                'comment' => null,
                                'appointment_date' => null,
                                'created_at' => null,
                            ];
                        }
                    })->toArray();
            } catch (\Exception $e) {
                \Log::error('Feedback Analytics: Error getting latest feedback', ['error' => $e->getMessage()]);
                $latestFeedback = [];
            }

            // Get rating distribution
            $ratingDistribution = [];
            try {
                $query = Feedback::whereBetween('created_at', [$startDate, $endDate]);
                if ($branchId) {
                    $query->where('branch_id', $branchId);
                }
                $ratingDistribution = $query->select('rating', DB::raw('COUNT(*) as count'))
                    ->groupBy('rating')
                    ->orderBy('rating')
                    ->get()
                    ->map(function ($item) {
                        return [
                            'rating' => $item->rating ?? 0,
                            'count' => $item->count ?? 0,
                            'percentage' => 0, // Will be calculated on frontend
                        ];
                    })->toArray();
            } catch (\Exception $e) {
                \Log::error('Feedback Analytics: Error getting rating distribution', ['error' => $e->getMessage()]);
                $ratingDistribution = [];
            }

            return response()->json([
                'branch_ratings' => $branchRatings,
                'overall_stats' => [
                    'avg_rating' => round($overallStats->overall_avg_rating ?? 0, 2),
                    'total_feedback' => $overallStats->total_feedback ?? 0,
                    'unique_customers' => $overallStats->unique_customers ?? 0,
                ],
                'trend_data' => $trendData,
                'latest_feedback' => $latestFeedback,
                'rating_distribution' => $ratingDistribution,
                'filters' => [
                    'start_date' => $startDate->format('Y-m-d'),
                    'end_date' => $endDate->format('Y-m-d'),
                    'branch_id' => $branchId,
                ]
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in FeedbackController::getAnalytics: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
            
            return response()->json([
                'message' => 'Error fetching feedback analytics',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error',
                'branch_ratings' => [],
                'overall_stats' => [
                    'avg_rating' => 0,
                    'total_feedback' => 0,
                    'unique_customers' => 0,
                ],
                'trend_data' => [],
                'latest_feedback' => [],
                'rating_distribution' => [],
                'filters' => [
                    'start_date' => $request->get('start_date') ?? Carbon::now()->subMonths(6)->format('Y-m-d'),
                    'end_date' => $request->get('end_date') ?? Carbon::now()->format('Y-m-d'),
                    'branch_id' => $request->get('branch_id'),
                ]
            ], 200); // Return 200 OK with empty data instead of 500
        }
    }

    /**
     * Get appointments available for feedback (completed appointments without feedback)
     */
    public function getAvailableAppointments(Request $request)
    {
        try {
            $user = $request->user();
            if (!$user) {
                \Log::error('No authenticated user in getAvailableAppointments');
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            // Handle different role formats more robustly
            $userRole = null;
            if (is_object($user->role)) {
                $userRole = $user->role->value ?? (string)$user->role;
            } else {
                $userRole = (string)$user->role;
            }
            
            \Log::info('User role in getAvailableAppointments: ' . $userRole . ', User ID: ' . $user->id);

            // Only customers can view their available appointments
            if ($userRole !== 'customer') {
                \Log::error('User role is not customer: ' . $userRole);
                return response()->json(['message' => 'Unauthorized - Customer access required'], 403);
            }

            // Get all completed appointments for the user
            \Log::info('Fetching completed appointments for user: ' . $user->id);
            $completedAppointments = Appointment::where('patient_id', $user->id)
                ->where('status', 'completed')
                ->with(['optometrist', 'branch'])
                ->orderBy('appointment_date', 'desc')
                ->get();
            \Log::info('Found ' . $completedAppointments->count() . ' completed appointments');

            // Get appointment IDs that already have feedback
            \Log::info('Fetching feedback for user: ' . $user->id);
            $appointmentsWithFeedback = Feedback::where('customer_id', $user->id)
                ->pluck('appointment_id')
                ->toArray();
            \Log::info('Found ' . count($appointmentsWithFeedback) . ' appointments with feedback');

            // Filter out appointments that already have feedback
            $availableAppointments = $completedAppointments->filter(function ($appointment) use ($appointmentsWithFeedback) {
                return !in_array($appointment->id, $appointmentsWithFeedback);
            })->map(function ($appointment) {
                return [
                    'id' => $appointment->id,
                    'date' => $appointment->appointment_date,
                    'time' => $appointment->start_time,
                    'type' => $appointment->type,
                    'optometrist_name' => $appointment->optometrist?->name,
                    'branch_name' => $appointment->branch?->name,
                ];
            });

            \Log::info('Returning ' . $availableAppointments->count() . ' available appointments');

            return response()->json([
                'appointments' => $availableAppointments->values()->toArray()
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in getAvailableAppointments: ' . $e->getMessage());
            \Log::error('Stack trace: ' . $e->getTraceAsString());
            
            // Return proper error response
            return response()->json([
                'appointments' => [],
                'error' => 'An error occurred while fetching available appointments',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified feedback.
     */
    public function show($id)
    {
        try {
            $user = Auth::user();
            
            // Handle role format
            $userRole = null;
            if (is_object($user->role)) {
                $userRole = $user->role->value ?? (string)$user->role;
            } else {
                $userRole = (string)$user->role;
            }

            $feedback = Feedback::with(['branch', 'appointment.optometrist', 'appointment.patient'])
                ->findOrFail($id);

            // Check authorization
            if ($userRole === 'customer' && $feedback->customer_id !== $user->id) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            if (!in_array($userRole, ['customer', 'staff', 'admin'])) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            return response()->json([
                'id' => $feedback->id,
                'appointment_id' => $feedback->appointment_id,
                'rating' => $feedback->rating,
                'comment' => $feedback->comment,
                'created_at' => $feedback->created_at->toISOString(),
                'appointment' => $feedback->appointment ? [
                    'id' => $feedback->appointment->id,
                    'appointment_date' => $feedback->appointment->appointment_date,
                    'appointment_time' => $feedback->appointment->start_time,
                    'appointment_type' => $feedback->appointment->type,
                    'optometrist' => $feedback->appointment->optometrist ? [
                        'id' => $feedback->appointment->optometrist->id,
                        'name' => $feedback->appointment->optometrist->name,
                    ] : null,
                    'patient' => $feedback->appointment->patient ? [
                        'id' => $feedback->appointment->patient->id,
                        'name' => $feedback->appointment->patient->name,
                    ] : null,
                ] : null,
                'branch' => $feedback->branch ? [
                    'id' => $feedback->branch->id,
                    'name' => $feedback->branch->name,
                ] : null,
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in show feedback: ' . $e->getMessage());
            return response()->json([
                'message' => 'An error occurred while fetching feedback',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}