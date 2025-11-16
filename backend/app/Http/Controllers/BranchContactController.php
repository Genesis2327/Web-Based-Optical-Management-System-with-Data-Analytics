<?php

namespace App\Http\Controllers;

use App\Models\BranchContact;
use App\Models\Branch;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class BranchContactController extends Controller
{
    /**
     * Get contact information for all branches
     * GET /api/branch-contacts
     */
    public function index(): JsonResponse
    {
        try {
            // Get all active branches with their contact information
            $branches = Branch::active()->get();
            
            $contacts = $branches->map(function ($branch) {
                return [
                    'id' => $branch->id,
                    'branch_id' => $branch->id,
                    'branch_name' => $branch->name,
                    'phone_number' => $branch->phone,
                    'formatted_phone' => $branch->phone,
                    'email' => $branch->email,
                    'whatsapp_number' => $branch->phone,
                    'formatted_whatsapp' => $branch->phone,
                    'whatsapp_link' => $branch->phone ? 'https://wa.me/' . preg_replace('/[^0-9]/', '', $branch->phone) : '',
                    'address' => $branch->address,
                    'operating_hours' => 'Mon-Fri: 8AM-6PM, Sat: 9AM-4PM',
                    'social_media' => [
                        'facebook' => 'https://facebook.com/everbrightoptical',
                        'instagram' => 'https://instagram.com/everbrightoptical'
                    ],
                    'is_active' => $branch->is_active
                ];
            });

            return response()->json([
                'contacts' => $contacts,
                'count' => $contacts->count()
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to fetch branch contacts: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to fetch contacts'], 500);
        }
    }

    /**
     * Get contact information for a specific branch
     * GET /api/branch-contacts/{branchId}
     */
    public function show($branchId): JsonResponse
    {
        try {
            $branch = Branch::find($branchId);
            
            if (!$branch) {
                return response()->json(['error' => 'Branch not found'], 404);
            }

            return response()->json([
                'contact' => [
                    'id' => $branch->id,
                    'branch_id' => $branch->id,
                    'branch_name' => $branch->name,
                    'phone_number' => $branch->phone,
                    'formatted_phone' => $branch->phone,
                    'email' => $branch->email,
                    'whatsapp_number' => $branch->phone,
                    'formatted_whatsapp' => $branch->phone,
                    'whatsapp_link' => $branch->phone ? 'https://wa.me/' . preg_replace('/[^0-9]/', '', $branch->phone) : '',
                    'address' => $branch->address,
                    'operating_hours' => 'Mon-Fri: 8AM-6PM, Sat: 9AM-4PM',
                    'social_media' => [
                        'facebook' => 'https://facebook.com/everbrightoptical',
                        'instagram' => 'https://instagram.com/everbrightoptical'
                    ],
                    'is_active' => $branch->is_active
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to fetch branch contact: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to fetch contact'], 500);
        }
    }

    /**
     * Create or update contact information for a branch
     * POST /api/branch-contacts
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'branch_id' => 'required|exists:branches,id',
            'phone_number' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:255',
            'facebook_url' => 'nullable|url|max:255',
            'instagram_url' => 'nullable|url|max:255',
            'twitter_url' => 'nullable|url|max:255',
            'linkedin_url' => 'nullable|url|max:255',
            'whatsapp_number' => 'nullable|string|max:20',
            'address' => 'nullable|string|max:500',
            'operating_hours' => 'nullable|string|max:255',
            'is_active' => 'boolean'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $data = $validator->validated();
            
            // Check if contact already exists for this branch
            $existingContact = BranchContact::where('branch_id', $data['branch_id'])->first();
            
            if ($existingContact) {
                // Update existing contact
                $existingContact->update($data);
                $contact = $existingContact;
                $message = 'Contact information updated successfully';
            } else {
                // Create new contact
                $contact = BranchContact::create($data);
                $message = 'Contact information created successfully';
            }

            Log::info('Branch contact saved', [
                'branch_id' => $data['branch_id'],
                'contact_id' => $contact->id
            ]);

            return response()->json([
                'message' => $message,
                'contact' => [
                    'id' => $contact->id,
                    'branch_id' => $contact->branch_id,
                    'phone_number' => $contact->phone_number,
                    'email' => $contact->email,
                    'whatsapp_number' => $contact->whatsapp_number,
                    'address' => $contact->address,
                    'operating_hours' => $contact->operating_hours,
                    'social_media' => $contact->social_media_links
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to save branch contact: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to save contact'], 500);
        }
    }

    /**
     * Update contact information for a branch
     * PUT /api/branch-contacts/{id}
     */
    public function update(Request $request, $id): JsonResponse
    {
        $contact = BranchContact::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'phone_number' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:255',
            'facebook_url' => 'nullable|url|max:255',
            'instagram_url' => 'nullable|url|max:255',
            'twitter_url' => 'nullable|url|max:255',
            'linkedin_url' => 'nullable|url|max:255',
            'whatsapp_number' => 'nullable|string|max:20',
            'address' => 'nullable|string|max:500',
            'operating_hours' => 'nullable|string|max:255',
            'is_active' => 'boolean'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $data = $validator->validated();
            $contact->update($data);

            Log::info('Branch contact updated', [
                'contact_id' => $contact->id,
                'branch_id' => $contact->branch_id
            ]);

            return response()->json([
                'message' => 'Contact information updated successfully',
                'contact' => [
                    'id' => $contact->id,
                    'branch_id' => $contact->branch_id,
                    'phone_number' => $contact->phone_number,
                    'email' => $contact->email,
                    'whatsapp_number' => $contact->whatsapp_number,
                    'address' => $contact->address,
                    'operating_hours' => $contact->operating_hours,
                    'social_media' => $contact->social_media_links
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to update branch contact: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to update contact'], 500);
        }
    }

    /**
     * Delete contact information for a branch
     * DELETE /api/branch-contacts/{id}
     */
    public function destroy($id): JsonResponse
    {
        try {
            $contact = BranchContact::findOrFail($id);
            $contact->delete();

            Log::info('Branch contact deleted (soft deleted)', [
                'contact_id' => $id,
                'branch_id' => $contact->branch_id
            ]);

            return response()->json([
                'message' => 'Contact information deleted successfully (soft deleted - data preserved in database)'
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to delete branch contact: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to delete contact'], 500);
        }
    }

    /**
     * Get contact information for customer's branch
     * GET /api/branch-contacts/my-branch
     */
    public function getMyBranchContact(): JsonResponse
    {
        try {
            $user = Auth::user();
            
            if (!$user) {
                return response()->json(['error' => 'Unauthorized'], 401);
            }

            $branchId = $user->branch_id;
            
            if (!$branchId) {
                return response()->json(['error' => 'User has no assigned branch'], 404);
            }

            // Get branch information directly from branches table
            $branch = Branch::find($branchId);
            
            if (!$branch) {
                return response()->json(['error' => 'Branch not found'], 404);
            }

            // Return branch contact information
            return response()->json([
                'contact' => [
                    'id' => $branch->id,
                    'branch_id' => $branch->id,
                    'branch_name' => $branch->name,
                    'phone_number' => $branch->phone,
                    'formatted_phone' => $branch->phone,
                    'email' => $branch->email,
                    'whatsapp_number' => $branch->phone, // Use same phone for WhatsApp
                    'formatted_whatsapp' => $branch->phone,
                    'whatsapp_link' => $branch->phone ? 'https://wa.me/' . preg_replace('/[^0-9]/', '', $branch->phone) : '',
                    'address' => $branch->address,
                    'operating_hours' => 'Mon-Fri: 8AM-6PM, Sat: 9AM-4PM', // Default hours
                    'social_media' => [
                        'facebook' => 'https://facebook.com/everbrightoptical',
                        'instagram' => 'https://instagram.com/everbrightoptical'
                    ],
                    'is_active' => $branch->is_active
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to fetch user branch contact: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to fetch contact'], 500);
        }
    }
}
