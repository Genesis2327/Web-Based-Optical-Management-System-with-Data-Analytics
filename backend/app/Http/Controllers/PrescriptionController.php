<?php

namespace App\Http\Controllers;

use App\Models\Prescription;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use App\Enums\UserRole;
use App\Helpers\Realtime;

class PrescriptionController extends Controller
{
    /**
     * Test method to debug authentication
     */
    public function test()
    {
        $user = Auth::user();
        return response()->json([
            'message' => 'PrescriptionController test method',
            'user' => $user ? $user->name : 'No user',
            'authenticated' => $user !== null
        ]);
    }

    /**
     * Display a listing of prescriptions based on user role.
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();
            
            // Debug: Log user information
            \Log::info('PrescriptionController index - User:', ['user' => $user]);
            
            if (!$user) {
                \Log::error('No authenticated user found in index method');
                return response()->json(['error' => 'User not authenticated'], 401);
            }
            
            $query = Prescription::with(['patient', 'optometrist', 'appointment']);

            // Filter based on user role
            if (!$user->role) {
                \Log::error('User role not found for user: ' . $user->id);
                return response()->json(['error' => 'User role not found'], 400);
            }
        
        switch ($user->role->value) {
            case UserRole::CUSTOMER->value:
                // Customers can only see their own prescriptions
                $query->where('patient_id', $user->id);
                break;

            case UserRole::OPTOMETRIST->value:
                // Optometrists can see prescriptions they created
                if ($request->has('my_prescriptions') && $request->boolean('my_prescriptions')) {
                    $query->where('optometrist_id', $user->id);
                }
                break;

            case UserRole::STAFF->value:
            case UserRole::ADMIN->value:
                // Staff and admins can see all prescriptions
                break;

            default:
                return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Apply filters
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        if ($request->has('patient_name')) {
            $query->whereHas('patient', function ($q) use ($request) {
                $q->where('name', 'like', '%' . $request->patient_name . '%');
            });
        }

        $prescriptions = $query->with(['patient', 'optometrist', 'appointment', 'branch'])
                              ->orderBy('issue_date', 'desc')
                              ->paginate($request->get('per_page', 15));

        return response()->json($prescriptions);
        
        } catch (\Exception $e) {
            \Log::error('Error in PrescriptionController index: ' . $e->getMessage());
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }

    /**
     * Store a newly created prescription.
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json(['error' => 'User not authenticated'], 401);
            }

            // Only optometrists can create prescriptions
            if (!$user->role || $user->role->value !== UserRole::OPTOMETRIST->value) {
                return response()->json(['error' => 'Only optometrists can create prescriptions'], 403);
            }

        $validator = Validator::make($request->all(), [
            'appointment_id' => 'required|exists:appointments,id',
            'right_eye' => 'required|array',
            'right_eye.sphere' => 'nullable|numeric',
            'right_eye.cylinder' => 'nullable|numeric',
            'right_eye.axis' => 'nullable|numeric|between:0,180',
            'right_eye.pd' => 'nullable|numeric|min:0',
            'left_eye' => 'required|array',
            'left_eye.sphere' => 'nullable|numeric',
            'left_eye.cylinder' => 'nullable|numeric',
            'left_eye.axis' => 'nullable|numeric|between:0,180',
            'left_eye.pd' => 'nullable|numeric|min:0',
            'vision_acuity' => 'nullable|string|max:50',
            'additional_notes' => 'nullable|string|max:1000',
            'recommendations' => 'nullable|string|max:1000',
            'lens_type' => 'nullable|string|max:100',
            'coating' => 'nullable|string|max:100',
            'follow_up_date' => 'nullable|date|after:today',
            'follow_up_notes' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Get appointment details
        $appointment = \App\Models\Appointment::with(['patient', 'branch'])->findOrFail($request->appointment_id);
        
        // Since there's only one optometrist, they can create prescriptions for any appointment
        // Assign the optometrist to the appointment if not already assigned
        if ($appointment->optometrist_id !== $user->id) {
            $appointment->update(['optometrist_id' => $user->id]);
        }

        // Verify appointment is in progress
        if ($appointment->status !== 'in_progress') {
            return response()->json(['error' => 'Can only create prescriptions for appointments in progress'], 422);
        }

        // Create prescription
        $prescription = Prescription::create([
            'appointment_id' => $request->appointment_id,
            'patient_id' => $appointment->patient_id,
            'optometrist_id' => $user->id,
            'type' => 'glasses', // Use valid enum value
            'prescription_data' => [
                'right_eye' => $request->right_eye,
                'left_eye' => $request->left_eye,
                'vision_acuity' => $request->vision_acuity,
                'additional_notes' => $request->additional_notes,
                'recommendations' => $request->recommendations,
                'lens_type' => $request->lens_type,
                'coating' => $request->coating,
                'follow_up_date' => $request->follow_up_date,
                'follow_up_notes' => $request->follow_up_notes,
                'prescription_number' => Prescription::generatePrescriptionNumber(),
            ],
            'issue_date' => now()->toDateString(),
            'expiry_date' => now()->addYear()->toDateString(),
            'status' => 'active',
            'notes' => $request->additional_notes, // Store additional notes in the notes field
        ]);

        // Update appointment status to completed
        $appointment->update(['status' => 'completed']);

        // Create notifications
        try {
            \App\Http\Controllers\NotificationController::createPrescriptionNotification(
                $prescription,
                'created',
                "Your prescription has been created and is ready for pickup at {$appointment->branch->name}"
            );
        } catch (\Exception $e) {
            \Log::error('Failed to create prescription notification: ' . $e->getMessage());
        }

        // Emit realtime event
        try {
            Realtime::emit('prescription.created', [
                'prescription' => $prescription->load(['patient:id,name', 'optometrist:id,name', 'appointment:id']),
            ], null, $prescription->patient_id);
        } catch (\Exception $e) {
            \Log::error('Failed to emit realtime event: ' . $e->getMessage());
        }

        return response()->json($prescription->load(['patient', 'optometrist', 'appointment']), 201);
        
        } catch (\Exception $e) {
            \Log::error('Prescription store error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'request_data' => $request->all()
            ]);
            return response()->json(['error' => 'Server error: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Display the specified prescription.
     */
    public function show(Prescription $prescription): JsonResponse
    {
        $user = Auth::user();

        // Check if user has permission to view this prescription
        if (!$this->canViewPrescription($user, $prescription)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        return response()->json($prescription->load(['patient', 'optometrist', 'appointment']));
    }

    /**
     * Update the specified prescription.
     */
    public function update(Request $request, Prescription $prescription): JsonResponse
    {
        $user = Auth::user();

        // Check if user has permission to update this prescription
        if (!$this->canUpdatePrescription($user, $prescription)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'type' => 'sometimes|in:glasses,contact_lenses,sunglasses,progressive,bifocal',
            'prescription_data' => 'sometimes|array',
            'issue_date' => 'sometimes|date',
            'expiry_date' => 'sometimes|date|after:issue_date',
            'notes' => 'nullable|string|max:1000',
            'status' => 'sometimes|in:active,expired,cancelled',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $prescription->update($validator->validated());

        return response()->json($prescription->load(['patient', 'optometrist', 'appointment']));
    }

    /**
     * Remove the specified prescription.
     */
    public function destroy(Prescription $prescription): JsonResponse
    {
        $user = Auth::user();

        // Check if user has permission to delete this prescription
        if (!$this->canDeletePrescription($user, $prescription)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $prescription->delete();

        return response()->json(['message' => 'Prescription deleted successfully']);
    }

    /**
     * Get prescriptions for a specific patient.
     */
    public function getPatientPrescriptions(Request $request, $patientId): JsonResponse
    {
        $user = Auth::user();

        // Check if user has permission to view patient prescriptions
        if (!$this->canViewPatientPrescriptions($user, $patientId)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $prescriptions = Prescription::with(['patient', 'optometrist', 'appointment'])
            ->where('patient_id', $patientId)
            ->orderBy('issue_date', 'desc')
            ->get();

        return response()->json($prescriptions);
    }

    /**
     * Check if user can view the prescription.
     */
    private function canViewPrescription(User $user, Prescription $prescription): bool
    {
        switch ($user->role->value) {
            case UserRole::CUSTOMER->value:
                return $prescription->patient_id === $user->id;

            case UserRole::OPTOMETRIST->value:
                // Since there's only one optometrist, they can view all prescriptions
                return true;

            case UserRole::STAFF->value:
            case UserRole::ADMIN->value:
                return true;

            default:
                return false;
        }
    }

    /**
     * Check if user can update the prescription.
     */
    private function canUpdatePrescription(User $user, Prescription $prescription): bool
    {
        switch ($user->role->value) {
            case UserRole::CUSTOMER->value:
                return false; // Customers cannot update prescriptions

            case UserRole::OPTOMETRIST->value:
                // Since there's only one optometrist, they can update all prescriptions
                return true;

            case UserRole::STAFF->value:
            case UserRole::ADMIN->value:
                return true;

            default:
                return false;
        }
    }

    /**
     * Check if user can delete the prescription.
     */
    private function canDeletePrescription(User $user, Prescription $prescription): bool
    {
        switch ($user->role->value) {
            case UserRole::CUSTOMER->value:
                return false; // Customers cannot delete prescriptions

            case UserRole::OPTOMETRIST->value:
            case UserRole::STAFF->value:
            case UserRole::ADMIN->value:
                return true;

            default:
                return false;
        }
    }

    /**
     * Check if user can view patient prescriptions.
     */
    private function canViewPatientPrescriptions(User $user, $patientId): bool
    {
        switch ($user->role->value) {
            case UserRole::CUSTOMER->value:
                return $patientId == $user->id;

            case UserRole::OPTOMETRIST->value:
            case UserRole::STAFF->value:
            case UserRole::ADMIN->value:
                return true;

            default:
                return false;
        }
    }
}