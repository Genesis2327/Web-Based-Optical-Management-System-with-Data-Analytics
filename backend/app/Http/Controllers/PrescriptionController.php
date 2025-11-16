<?php

namespace App\Http\Controllers;

use App\Models\Prescription;
use App\Models\User;
use App\Http\Resources\PrescriptionResource;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
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

        return PrescriptionResource::collection($prescriptions)->response();
        
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

        // Use database transaction to ensure data consistency
        DB::beginTransaction();
        
        try {
            // Ensure eye data is properly formatted as arrays
            $rightEye = is_array($request->right_eye) ? $request->right_eye : [];
            $leftEye = is_array($request->left_eye) ? $request->left_eye : [];
            
            \Log::info('Creating prescription with eye data', [
                'right_eye_raw' => $request->right_eye,
                'left_eye_raw' => $request->left_eye,
                'right_eye_processed' => $rightEye,
                'left_eye_processed' => $leftEye,
            ]);
            
            // Create prescription
            $prescription = Prescription::create([
                'appointment_id' => $request->appointment_id,
                'patient_id' => $appointment->patient_id,
                'optometrist_id' => $user->id,
                'branch_id' => $appointment->branch_id,
                'type' => 'glasses', // Use valid enum value
                'prescription_number' => Prescription::generatePrescriptionNumber(),
                'right_eye' => $rightEye, // Laravel will auto-encode to JSON via cast
                'left_eye' => $leftEye, // Laravel will auto-encode to JSON via cast
                'vision_acuity' => $request->vision_acuity,
                'additional_notes' => $request->additional_notes,
                'recommendations' => $request->recommendations,
                'lens_type' => $request->lens_type,
                'coating' => $request->coating,
                'follow_up_date' => $request->follow_up_date,
                'follow_up_notes' => $request->follow_up_notes,
                'prescription_data' => [
                    'prescription_number' => Prescription::generatePrescriptionNumber(),
                    // Also store in prescription_data as backup
                    'right_eye' => $rightEye,
                    'left_eye' => $leftEye,
                ],
                'issue_date' => now()->toDateString(),
                'expiry_date' => now()->addYear()->toDateString(),
                'status' => 'active',
                'notes' => $request->additional_notes, // Store additional notes in the notes field
            ]);
            
            \Log::info('Prescription created with eye data', [
                'prescription_id' => $prescription->id,
                'right_eye' => $prescription->right_eye,
                'left_eye' => $prescription->left_eye,
                'right_eye_type' => gettype($prescription->right_eye),
                'left_eye_type' => gettype($prescription->left_eye),
                'right_eye_is_array' => is_array($prescription->right_eye),
                'left_eye_is_array' => is_array($prescription->left_eye),
            ]);

            // Verify prescription was created successfully
            if (!$prescription || !$prescription->id) {
                throw new \Exception('Failed to create prescription record');
            }

            \Log::info('Prescription created successfully', [
                'prescription_id' => $prescription->id,
                'patient_id' => $prescription->patient_id,
                'appointment_id' => $prescription->appointment_id,
                'branch_id' => $prescription->branch_id,
                'optometrist_id' => $prescription->optometrist_id
            ]);

            // Update appointment status to completed
            $appointment->update(['status' => 'completed']);

            // Commit transaction
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Failed to create prescription in transaction', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw $e;
        }

        // Load prescription with all relationships for notifications and events
        $prescription->load(['patient', 'optometrist', 'appointment', 'branch']);

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

        // Emit realtime events for all relevant roles
        try {
            // Emit to patient (customer) - user-specific event
            Realtime::emit('prescription.created', [
                'id' => $prescription->id,
                'type' => 'prescription.created',
                'message' => "Your prescription has been created",
                'prescription' => [
                    'id' => $prescription->id,
                    'patient_id' => $prescription->patient_id,
                    'appointment_id' => $prescription->appointment_id,
                    'prescription_number' => $prescription->prescription_number,
                    'status' => $prescription->status,
                    'issue_date' => $prescription->issue_date,
                ],
                'patient' => $prescription->patient ? [
                    'id' => $prescription->patient->id,
                    'name' => $prescription->patient->name,
                ] : null,
                'optometrist' => $prescription->optometrist ? [
                    'id' => $prescription->optometrist->id,
                    'name' => $prescription->optometrist->name,
                ] : null,
                'timestamp' => now()->toISOString(),
            ], $prescription->branch_id, $prescription->patient_id);

            \Log::info('Realtime event emitted for prescription', [
                'prescription_id' => $prescription->id,
                'patient_id' => $prescription->patient_id,
                'branch_id' => $prescription->branch_id
            ]);
        } catch (\Exception $e) {
            \Log::error('Failed to emit realtime event: ' . $e->getMessage());
            // Don't fail the request if realtime fails
        }

        \Log::info('Prescription creation completed successfully', [
            'prescription_id' => $prescription->id,
            'patient_id' => $prescription->patient_id,
            'branch_id' => $prescription->branch_id,
            'optometrist_id' => $prescription->optometrist_id,
            'will_be_visible_to' => [
                'patient' => true,
                'staff_at_branch' => $prescription->branch_id ? true : false,
                'admin' => true,
                'optometrist' => true,
            ]
        ]);

        // Ensure all relationships are loaded before returning
        $prescription->load(['patient', 'optometrist', 'appointment', 'branch']);
        
        // Refresh the prescription to ensure we get the latest data from database
        $prescription->refresh();
        
        \Log::info('Returning prescription response', [
            'prescription_id' => $prescription->id,
            'right_eye' => $prescription->right_eye,
            'left_eye' => $prescription->left_eye,
            'right_eye_raw' => $prescription->getAttribute('right_eye'),
            'left_eye_raw' => $prescription->getAttribute('left_eye'),
        ]);
        
        return (new PrescriptionResource($prescription))->response()->setStatusCode(201);
        
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

        return new PrescriptionResource($prescription->load(['patient', 'optometrist', 'appointment']));
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

        return new PrescriptionResource($prescription->load(['patient', 'optometrist', 'appointment']));
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

        return response()->json(['message' => 'Prescription deleted successfully (soft deleted - data preserved in database)']);
    }

    /**
     * Get prescriptions for a specific patient.
     */
    public function getPatientPrescriptions(Request $request, $patientId): JsonResponse
    {
        try {
            $user = Auth::user();
            
            if (!$user) {
                \Log::error('No authenticated user in getPatientPrescriptions');
                return response()->json(['error' => 'User not authenticated'], 401);
            }
            
            if (!$user->role) {
                \Log::error('User role not found for user: ' . $user->id);
                return response()->json(['error' => 'User role not found'], 400);
            }
            
            \Log::info('getPatientPrescriptions called', [
                'user_id' => $user->id,
                'user_role' => $user->role->value,
                'patient_id' => $patientId,
                'match' => $patientId == $user->id
            ]);

            // Check if user has permission to view patient prescriptions
            if (!$this->canViewPatientPrescriptions($user, $patientId)) {
                \Log::warning('Access denied to patient prescriptions', [
                    'user_id' => $user->id,
                    'user_role' => $user->role->value,
                    'requested_patient_id' => $patientId
                ]);
                return response()->json(['error' => 'Unauthorized'], 403);
            }

            $prescriptions = Prescription::with(['patient', 'optometrist', 'appointment', 'branch'])
                ->where('patient_id', $patientId)
                ->orderBy('issue_date', 'desc')
                ->get();
            
            \Log::info('Prescriptions fetched successfully', [
                'count' => $prescriptions->count(),
                'patient_id' => $patientId
            ]);

            $resource = PrescriptionResource::collection($prescriptions);
            \Log::info('PrescriptionResource created', ['resource_type' => get_class($resource)]);
            
            return $resource->response();
            
        } catch (\Exception $e) {
            \Log::error('Error in getPatientPrescriptions: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json(['error' => 'Internal server error'], 500);
        }
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
        if (!$user || !$user->role) {
            \Log::error('Invalid user or role in canViewPatientPrescriptions');
            return false;
        }
        
        switch ($user->role->value) {
            case UserRole::CUSTOMER->value:
                // Use strict comparison after type casting to ensure proper comparison
                $result = (int)$patientId === (int)$user->id;
                \Log::info('Customer prescription access check', [
                    'patient_id' => $patientId,
                    'user_id' => $user->id,
                    'result' => $result
                ]);
                return $result;

            case UserRole::OPTOMETRIST->value:
            case UserRole::STAFF->value:
            case UserRole::ADMIN->value:
                return true;

            default:
                \Log::warning('Unknown role in canViewPatientPrescriptions', [
                    'role' => $user->role->value
                ]);
                return false;
        }
    }
}