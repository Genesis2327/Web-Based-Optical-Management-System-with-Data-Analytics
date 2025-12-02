<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PrescriptionResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'appointment_id' => $this->appointment_id,
            'patient_id' => $this->patient_id,
            'optometrist_id' => $this->optometrist_id,
            'branch_id' => $this->branch_id,
            'type' => $this->type,
            'prescription_number' => $this->prescription_number,
            // Get eye data - use direct column first, fallback to prescription_data
            // Laravel's array cast automatically decodes JSON, so $this->right_eye is already an array
            'right_eye' => $this->right_eye !== null ? $this->right_eye : ($this->prescription_data['right_eye'] ?? []),
            'left_eye' => $this->left_eye !== null ? $this->left_eye : ($this->prescription_data['left_eye'] ?? []),
            'vision_acuity' => $this->vision_acuity,
            'additional_notes' => $this->additional_notes,
            'recommendations' => $this->recommendations,
            'lens_type' => $this->lens_type,
            'coating' => $this->coating,
            'follow_up_date' => $this->follow_up_date,
            'follow_up_notes' => $this->follow_up_notes,
            'issue_date' => $this->issue_date,
            'expiry_date' => $this->expiry_date,
            'status' => $this->status,
            'notes' => $this->notes,
            'attachment_path' => $this->attachment_path,
            'attachment_url' => $this->attachment_url,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'deleted_at' => $this->deleted_at,
            'patient' => $this->whenLoaded('patient', function () {
                if (!$this->patient) {
                    return null;
                }
                return [
                    'id' => $this->patient->id,
                    'name' => $this->patient->name,
                    'email' => $this->patient->email,
                ];
            }),
            'optometrist' => $this->whenLoaded('optometrist', function () {
                if (!$this->optometrist) {
                    return null;
                }
                return [
                    'id' => $this->optometrist->id,
                    'name' => $this->optometrist->name,
                    'email' => $this->optometrist->email,
                ];
            }),
            'appointment' => $this->whenLoaded('appointment', function () {
                if (!$this->appointment) {
                    return null;
                }
                return [
                    'id' => $this->appointment->id,
                    'appointment_date' => $this->appointment->appointment_date,
                    'start_time' => $this->appointment->start_time,
                    'type' => $this->appointment->type,
                ];
            }),
            'branch' => $this->whenLoaded('branch', function () {
                if (!$this->branch) {
                    return null;
                }
                return [
                    'id' => $this->branch->id,
                    'name' => $this->branch->name,
                    'code' => $this->branch->code,
                ];
            }),
        ];
    }
}
