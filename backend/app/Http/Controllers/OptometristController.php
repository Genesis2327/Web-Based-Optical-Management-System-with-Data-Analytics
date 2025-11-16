<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Appointment;
use App\Models\Prescription;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;

class OptometristController extends Controller
{
    /**
     * Get all optometrists (public endpoint for scheduling)
     */
    public function index(): JsonResponse
    {
        try {
            // Get optometrists - handle both enum and string role values
            $optometrists = User::where(function($query) {
                    $query->where('role', 'optometrist')
                          ->orWhere('role', \App\Enums\UserRole::OPTOMETRIST);
                })
                ->where('is_approved', true)
                ->select('id', 'name', 'email')
                ->get()
                ->map(function ($optometrist) {
                    return [
                        'id' => $optometrist->id,
                        'name' => $optometrist->name,
                        'email' => $optometrist->email,
                        'phone' => $optometrist->phone ?? null,
                        'specialization' => 'General Optometry', // Default specialization
                    ];
                });

            return response()->json([
                'optometrists' => $optometrists,
                'total' => $optometrists->count()
            ]);

        } catch (\Exception $e) {
            \Log::error('Failed to fetch optometrists: ' . $e->getMessage(), [
                'exception' => $e,
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'error' => 'Failed to fetch optometrists',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all patients for the authenticated optometrist
     */
    public function getPatients(Request $request): JsonResponse
    {
        $optometrist = Auth::user();
        
        if (!$optometrist || ($optometrist->role->value ?? (string)$optometrist->role) !== 'optometrist') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Get all patients who have appointments with this optometrist
        $patientIds = Appointment::where('optometrist_id', $optometrist->id)
            ->distinct()
            ->pluck('patient_id');

        $patients = User::whereIn('id', $patientIds)
            ->where('role', 'customer')
            ->with(['appointments' => function($query) use ($optometrist) {
                $query->where('optometrist_id', $optometrist->id)
                      ->orderBy('appointment_date', 'desc');
            }])
            ->with(['prescriptions' => function($query) use ($optometrist) {
                $query->where('optometrist_id', $optometrist->id)
                      ->orderBy('issue_date', 'desc');
            }])
            ->get()
            ->map(function ($patient) {
                return [
                    'id' => $patient->id,
                    'name' => $patient->name,
                    'email' => $patient->email,
                    'phone' => $patient->phone,
                    'date_of_birth' => $patient->date_of_birth,
                    'last_visit' => $patient->appointments->first()?->appointment_date,
                    'next_appointment' => $patient->appointments->where('status', 'scheduled')->first()?->appointment_date,
                    'total_appointments' => $patient->appointments->count(),
                    'total_prescriptions' => $patient->prescriptions->count(),
                    'status' => 'active'
                ];
            });

        return response()->json([
            'data' => $patients,
            'total' => $patients->count()
        ]);
    }

    /**
     * Get a specific patient with detailed history
     */
    public function getPatient(Request $request, $patientId): JsonResponse
    {
        $optometrist = Auth::user();
        
        if (!$optometrist || ($optometrist->role->value ?? (string)$optometrist->role) !== 'optometrist') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $patient = User::where('id', $patientId)
            ->where('role', 'customer')
            ->first();

        if (!$patient) {
            return response()->json(['message' => 'Patient not found'], 404);
        }

        // Verify this patient has appointments with this optometrist
        $hasAppointments = Appointment::where('patient_id', $patientId)
            ->where('optometrist_id', $optometrist->id)
            ->exists();

        if (!$hasAppointments) {
            return response()->json(['message' => 'Patient not found in your records'], 404);
        }

        // Get appointments with this optometrist
        $appointments = Appointment::where('patient_id', $patientId)
            ->where('optometrist_id', $optometrist->id)
            ->with('branch')
            ->orderBy('appointment_date', 'desc')
            ->get()
            ->map(function ($appointment) {
                return [
                    'id' => $appointment->id,
                    'date' => $appointment->appointment_date?->format('Y-m-d'),
                    'time' => $appointment->start_time,
                    'type' => $appointment->type,
                    'status' => $appointment->status,
                    'branch' => $appointment->branch ? [
                        'name' => $appointment->branch->name,
                        'address' => $appointment->branch->address
                    ] : null,
                    'notes' => $appointment->notes,
                ];
            });

        // Get prescriptions issued by this optometrist
        $prescriptions = Prescription::where('patient_id', $patientId)
            ->where('optometrist_id', $optometrist->id)
            ->orderBy('issue_date', 'desc')
            ->get()
            ->map(function ($prescription) {
                return [
                    'id' => $prescription->id,
                    'prescription_number' => $prescription->prescription_number,
                    'issue_date' => $prescription->issue_date?->format('Y-m-d'),
                    'expiry_date' => $prescription->expiry_date?->format('Y-m-d'),
                    'status' => $prescription->status,
                    'type' => $prescription->type,
                    'right_eye' => $prescription->right_eye,
                    'left_eye' => $prescription->left_eye,
                    'vision_acuity' => $prescription->vision_acuity,
                    'recommendations' => $prescription->recommendations,
                    'additional_notes' => $prescription->additional_notes,
                ];
            });

        return response()->json([
            'patient' => [
                'id' => $patient->id,
                'name' => $patient->name,
                'email' => $patient->email,
                'phone' => $patient->phone ?? 'Not provided',
                'social_media' => $patient->social_media ?? 'Not provided',
                'address' => $patient->address ?? 'Not provided',
                'date_of_birth' => $patient->date_of_birth,
                'emergency_contact' => $patient->emergency_contact ?? 'Not provided',
                'emergency_phone' => $patient->emergency_phone ?? 'Not provided',
            ],
            'appointments' => $appointments,
            'prescriptions' => $prescriptions,
            'statistics' => [
                'total_appointments' => $appointments->count(),
                'total_prescriptions' => $prescriptions->count(),
                'last_visit' => $appointments->first()?->date,
                'next_appointment' => $appointments->where('status', 'scheduled')->first()?->date,
            ]
        ]);
    }

    /**
     * Get all prescriptions for the authenticated optometrist
     */
    public function getPrescriptions(Request $request): JsonResponse
    {
        $optometrist = Auth::user();
        
        if (!$optometrist || ($optometrist->role->value ?? (string)$optometrist->role) !== 'optometrist') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $prescriptions = Prescription::where('optometrist_id', $optometrist->id)
            ->with(['patient', 'appointment'])
            ->orderBy('issue_date', 'desc')
            ->get()
            ->map(function ($prescription) {
                return [
                    'id' => $prescription->id,
                    'prescription_number' => $prescription->prescription_number,
                    'issue_date' => $prescription->issue_date?->format('Y-m-d'),
                    'expiry_date' => $prescription->expiry_date?->format('Y-m-d'),
                    'status' => $prescription->status,
                    'type' => $prescription->type,
                    'patient' => $prescription->patient ? [
                        'id' => $prescription->patient->id,
                        'name' => $prescription->patient->name,
                        'email' => $prescription->patient->email,
                    ] : null,
                    'appointment' => $prescription->appointment ? [
                        'id' => $prescription->appointment->id,
                        'date' => $prescription->appointment->appointment_date?->format('Y-m-d'),
                        'type' => $prescription->appointment->type,
                    ] : null,
                    'right_eye' => $prescription->right_eye,
                    'left_eye' => $prescription->left_eye,
                    'vision_acuity' => $prescription->vision_acuity,
                    'recommendations' => $prescription->recommendations,
                    'additional_notes' => $prescription->additional_notes,
                ];
            });

        return response()->json([
            'data' => $prescriptions,
            'total' => $prescriptions->count()
        ]);
    }

    /**
     * Get today's appointments for the authenticated optometrist
     */
    public function getTodayAppointments(Request $request): JsonResponse
    {
        $optometrist = Auth::user();
        
        if (!$optometrist || ($optometrist->role->value ?? (string)$optometrist->role) !== 'optometrist') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $today = Carbon::today();
        
        $appointments = Appointment::where('optometrist_id', $optometrist->id)
            ->whereDate('appointment_date', $today)
            ->with(['patient', 'branch'])
            ->orderBy('start_time')
            ->get()
            ->map(function ($appointment) {
                return [
                    'id' => $appointment->id,
                    'patient' => $appointment->patient ? [
                        'id' => $appointment->patient->id,
                        'name' => $appointment->patient->name,
                        'email' => $appointment->patient->email,
                        'phone' => $appointment->patient->phone,
                    ] : null,
                    'date' => $appointment->appointment_date?->format('Y-m-d'),
                    'start_time' => $appointment->start_time,
                    'end_time' => $appointment->end_time,
                    'type' => $appointment->type,
                    'status' => $appointment->status,
                    'branch' => $appointment->branch ? [
                        'name' => $appointment->branch->name,
                        'address' => $appointment->branch->address
                    ] : null,
                    'notes' => $appointment->notes,
                ];
            });

        return response()->json([
            'data' => $appointments,
            'total' => $appointments->count()
        ]);
    }
}
