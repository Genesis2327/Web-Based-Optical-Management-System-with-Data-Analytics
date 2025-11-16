<?php

namespace App\Http\Controllers;

use App\Models\OptometristRotation;
use App\Models\Appointment;
use App\Models\User;
use App\Models\Branch;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Carbon\Carbon;

class AppointmentAvailabilityController extends Controller
{
    /**
     * Get available appointment slots for a specific date.
     */
    public function getAvailability(Request $request): JsonResponse
    {
        $request->validate([
            'date' => 'required|date|after_or_equal:today',
        ]);

        $date = Carbon::parse($request->date);
        $dayOfWeek = $date->dayOfWeekIso; // 1 = Monday, 7 = Sunday

        // Find all optometrist rotations for this day
        $rotations = OptometristRotation::with(['optometrist'])
            ->where('is_active', true)
            ->get();

        $availableOptometrists = [];
        
        foreach ($rotations as $rotation) {
            foreach ($rotation->rotation_schedule as $schedule) {
                if ($schedule['day'] === $dayOfWeek) {
                    // Get already booked appointments for this optometrist on this date
                    $bookedAppointments = Appointment::where('optometrist_id', $rotation->optometrist_id)
                        ->where('appointment_date', $date->toDateString())
                        ->whereIn('status', ['scheduled', 'confirmed'])
                        ->get(['start_time', 'end_time']);

                    $availableTimeSlots = $this->generateTimeSlots(
                        $schedule['start_time'],
                        $schedule['end_time'],
                        $bookedAppointments
                    );

                    $availableOptometrists[] = [
                        'optometrist_id' => $rotation->optometrist_id,
                        'optometrist_name' => $rotation->optometrist->name,
                        'branch_id' => $schedule['branch_id'],
                        'start_time' => $schedule['start_time'],
                        'end_time' => $schedule['end_time'],
                        'available_times' => $availableTimeSlots,
                    ];
                }
            }
        }

        if (empty($availableOptometrists)) {
            return response()->json([
                'date' => $date->format('Y-m-d'),
                'available' => false,
                'message' => 'No optometrists available on this date'
            ]);
        }

        return response()->json([
            'date' => $date->format('Y-m-d'),
            'available_optometrists' => $availableOptometrists,
        ]);
    }

    /**
     * Get optometrist schedule for the week.
     */
    public function getWeeklySchedule(): JsonResponse
    {
        $rotations = OptometristRotation::with(['optometrist'])
            ->where('is_active', true)
            ->get();

        $weeklySchedule = [];
        $days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        foreach ($rotations as $rotation) {
            $optometrist = $rotation->optometrist;
            $scheduleByDay = [];
            
            // Group rotation schedule by day
            foreach ($rotation->rotation_schedule as $schedule) {
                $scheduleByDay[$schedule['day']] = $schedule;
            }

            $weeklySchedule[] = [
                'optometrist' => [
                    'id' => $optometrist->id,
                    'name' => $optometrist->name,
                ],
                'schedule' => collect($days)->map(function ($day, $index) use ($scheduleByDay) {
                    $dayNumber = $index + 1;
                    $schedule = $scheduleByDay[$dayNumber] ?? null;
                    
                    return [
                        'day' => $day,
                        'day_number' => $dayNumber,
                        'available' => $schedule ? true : false,
                        'branch' => $schedule ? [
                            'id' => $schedule['branch_id'],
                            'name' => 'Branch ' . $schedule['branch_id'], // You might want to load branch details
                        ] : null,
                        'schedule' => $schedule ? [
                            'start_time' => $schedule['start_time'],
                            'end_time' => $schedule['end_time'],
                        ] : null,
                    ];
                })
            ];
        }

        return response()->json(['weekly_schedule' => $weeklySchedule]);
    }

    /**
     * Generate available time slots based on schedule and existing appointments.
     */
    private function generateTimeSlots($startTime, $endTime, $existingAppointments): array
    {
        $slots = [];
        $current = Carbon::parse($startTime);
        $end = Carbon::parse($endTime);
        $slotDuration = 60; // 60 minutes per slot

        // Reset current to start time
        $current = Carbon::parse($startTime);

        while ($current->lt($end)) {
            $timeString = $current->format('H:i');
            $timeDisplay = $current->format('g:i A');
            
            // Check if this time slot is already booked
            $isBooked = $existingAppointments->contains(function ($appointment) use ($timeString) {
                return $appointment->start_time === $timeString;
            });

            if (!$isBooked) {
                $slots[] = $timeDisplay; // Return just the display format as required
            }
            
            $current->addMinutes($slotDuration);
        }

        return $slots;
    }
}