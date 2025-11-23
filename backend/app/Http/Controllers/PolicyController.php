<?php

namespace App\Http\Controllers;

use App\Models\Policy;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;

class PolicyController extends Controller
{
    /**
     * Get the latest active privacy policy
     */
    public function getPrivacyPolicy(): JsonResponse
    {
        $policy = Policy::getLatest('privacy_policy');

        if (!$policy) {
            return response()->json([
                'message' => 'Privacy policy not found',
                'policy' => null
            ], 404);
        }

        return response()->json([
            'policy' => [
                'id' => $policy->id,
                'type' => $policy->type,
                'version' => $policy->version,
                'title' => $policy->title,
                'content' => $policy->content,
                'effective_date' => $policy->effective_date?->format('Y-m-d'),
                'created_at' => $policy->created_at->format('Y-m-d H:i:s'),
            ]
        ]);
    }

    /**
     * Get the latest active terms and conditions
     */
    public function getTermsConditions(): JsonResponse
    {
        $terms = Policy::getLatest('terms_conditions');

        if (!$terms) {
            return response()->json([
                'message' => 'Terms and conditions not found',
                'policy' => null
            ], 404);
        }

        return response()->json([
            'policy' => [
                'id' => $terms->id,
                'type' => $terms->type,
                'version' => $terms->version,
                'title' => $terms->title,
                'content' => $terms->content,
                'effective_date' => $terms->effective_date?->format('Y-m-d'),
                'created_at' => $terms->created_at->format('Y-m-d H:i:s'),
            ]
        ]);
    }

    /**
     * Accept privacy policy (for authenticated users)
     */
    public function acceptPrivacyPolicy(Request $request): JsonResponse
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json([
                'message' => 'Unauthorized. Please log in to accept the privacy policy.'
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'version' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $policy = Policy::where('type', 'privacy_policy')
            ->where('version', $request->version)
            ->first();

        if (!$policy) {
            return response()->json([
                'message' => 'Invalid privacy policy version'
            ], 404);
        }

        $user->acceptPrivacyPolicy($request->version);

        return response()->json([
            'message' => 'Privacy policy accepted successfully',
            'accepted_at' => $user->privacy_policy_accepted_at->format('Y-m-d H:i:s'),
            'version' => $user->privacy_policy_version,
        ]);
    }

    /**
     * Accept terms and conditions (for authenticated users)
     */
    public function acceptTerms(Request $request): JsonResponse
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json([
                'message' => 'Unauthorized. Please log in to accept the terms and conditions.'
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'version' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $terms = Policy::where('type', 'terms_conditions')
            ->where('version', $request->version)
            ->first();

        if (!$terms) {
            return response()->json([
                'message' => 'Invalid terms and conditions version'
            ], 404);
        }

        $user->acceptTerms($request->version);

        return response()->json([
            'message' => 'Terms and conditions accepted successfully',
            'accepted_at' => $user->terms_accepted_at->format('Y-m-d H:i:s'),
            'version' => $user->terms_version,
        ]);
    }

    /**
     * Check if user needs to accept updated policies
     */
    public function checkPolicyAcceptance(): JsonResponse
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json([
                'needs_privacy_policy' => false,
                'needs_terms' => false,
            ]);
        }

        $latestPrivacyPolicy = Policy::getLatest('privacy_policy');
        $latestTerms = Policy::getLatest('terms_conditions');

        return response()->json([
            'needs_privacy_policy' => $latestPrivacyPolicy && !$user->hasAcceptedLatestPrivacyPolicy(),
            'needs_terms' => $latestTerms && !$user->hasAcceptedLatestTerms(),
            'privacy_policy_version' => $latestPrivacyPolicy?->version,
            'terms_version' => $latestTerms?->version,
        ]);
    }

    /**
     * Get all policies (Admin only)
     */
    public function index(Request $request): JsonResponse
    {
        $user = Auth::user();

        if (!$user || $user->role->value !== 'admin') {
            return response()->json([
                'message' => 'Unauthorized. Admin access required.'
            ], 403);
        }

        $type = $request->get('type');
        $query = Policy::query();

        if ($type) {
            $query->where('type', $type);
        }

        $policies = $query->orderBy('created_at', 'desc')
            ->with('creator:id,name,email')
            ->get()
            ->map(function ($policy) {
                return [
                    'id' => $policy->id,
                    'type' => $policy->type,
                    'version' => $policy->version,
                    'title' => $policy->title,
                    'content' => substr($policy->content, 0, 200) . '...',
                    'is_active' => $policy->is_active,
                    'effective_date' => $policy->effective_date?->format('Y-m-d'),
                    'created_by' => $policy->creator ? [
                        'id' => $policy->creator->id,
                        'name' => $policy->creator->name,
                        'email' => $policy->creator->email,
                    ] : null,
                    'created_at' => $policy->created_at->format('Y-m-d H:i:s'),
                ];
            });

        return response()->json([
            'policies' => $policies,
            'total' => $policies->count(),
        ]);
    }

    /**
     * Create a new policy (Admin only)
     */
    public function store(Request $request): JsonResponse
    {
        $user = Auth::user();

        if (!$user || $user->role->value !== 'admin') {
            return response()->json([
                'message' => 'Unauthorized. Admin access required.'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'type' => 'required|in:privacy_policy,terms_conditions',
            'version' => 'required|string|max:50',
            'title' => 'required|string|max:255',
            'content' => 'required|string',
            'effective_date' => 'nullable|date',
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $policy = Policy::create([
            'type' => $request->type,
            'version' => $request->version,
            'title' => $request->title,
            'content' => $request->content,
            'effective_date' => $request->effective_date ? Carbon::parse($request->effective_date) : now(),
            'created_by' => $user->id,
            'is_active' => $request->boolean('is_active', false),
        ]);

        // If activating, deactivate others
        if ($policy->is_active) {
            $policy->activate();
        }

        return response()->json([
            'message' => 'Policy created successfully',
            'policy' => [
                'id' => $policy->id,
                'type' => $policy->type,
                'version' => $policy->version,
                'title' => $policy->title,
                'is_active' => $policy->is_active,
                'effective_date' => $policy->effective_date->format('Y-m-d'),
            ]
        ], 201);
    }

    /**
     * Update a policy (Admin only)
     */
    public function update(Request $request, Policy $policy): JsonResponse
    {
        $user = Auth::user();

        if (!$user || $user->role->value !== 'admin') {
            return response()->json([
                'message' => 'Unauthorized. Admin access required.'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'version' => 'sometimes|string|max:50',
            'title' => 'sometimes|string|max:255',
            'content' => 'sometimes|string',
            'effective_date' => 'nullable|date',
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $updateData = [];
        if ($request->has('version')) {
            $updateData['version'] = $request->version;
        }
        if ($request->has('title')) {
            $updateData['title'] = $request->title;
        }
        if ($request->has('content')) {
            $updateData['content'] = $request->content;
        }
        if ($request->has('effective_date')) {
            $updateData['effective_date'] = $request->effective_date ? Carbon::parse($request->effective_date) : null;
        }
        if ($request->has('is_active')) {
            $updateData['is_active'] = $request->boolean('is_active');
        }

        $policy->update($updateData);

        // If activating, deactivate others
        if ($policy->is_active) {
            $policy->activate();
        }

        return response()->json([
            'message' => 'Policy updated successfully',
            'policy' => [
                'id' => $policy->id,
                'type' => $policy->type,
                'version' => $policy->version,
                'title' => $policy->title,
                'is_active' => $policy->is_active,
            ]
        ]);
    }

    /**
     * Activate a policy (Admin only)
     */
    public function activate(Policy $policy): JsonResponse
    {
        $user = Auth::user();

        if (!$user || $user->role->value !== 'admin') {
            return response()->json([
                'message' => 'Unauthorized. Admin access required.'
            ], 403);
        }

        $policy->activate();

        return response()->json([
            'message' => 'Policy activated successfully',
            'policy' => [
                'id' => $policy->id,
                'type' => $policy->type,
                'version' => $policy->version,
                'is_active' => $policy->is_active,
            ]
        ]);
    }

    /**
     * Get a specific policy
     */
    public function show(Policy $policy): JsonResponse
    {
        return response()->json([
            'policy' => [
                'id' => $policy->id,
                'type' => $policy->type,
                'version' => $policy->version,
                'title' => $policy->title,
                'content' => $policy->content,
                'is_active' => $policy->is_active,
                'effective_date' => $policy->effective_date?->format('Y-m-d'),
                'created_by' => $policy->creator ? [
                    'id' => $policy->creator->id,
                    'name' => $policy->creator->name,
                    'email' => $policy->creator->email,
                ] : null,
                'created_at' => $policy->created_at->format('Y-m-d H:i:s'),
            ]
        ]);
    }
}

