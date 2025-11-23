<?php

namespace App\Console\Commands;

use App\Models\EyewearReminder;
use App\Models\Notification;
use App\Services\WebSocketService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class SendEyewearReminders extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'eyewear:send-reminders';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send eyewear condition check reminders to customers';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Starting eyewear reminder process...');

        try {
            // Get all due reminders
            $dueReminders = EyewearReminder::due()->get();
            
            $this->info("Found {$dueReminders->count()} due reminders");

            $sentCount = 0;
            $skippedCount = 0;

            foreach ($dueReminders as $reminder) {
                try {
                    // Check if we already sent a reminder today
                    if ($reminder->last_notification_sent && 
                        Carbon::parse($reminder->last_notification_sent)->isToday()) {
                        $this->warn("Skipping reminder {$reminder->id} - already sent today");
                        $skippedCount++;
                        continue;
                    }

                    // Send notification
                    $this->sendReminderNotification($reminder);
                    
                    // Mark as sent
                    $reminder->markAsSent();
                    
                    $sentCount++;
                    $this->info("Sent reminder to user {$reminder->user_id} for {$reminder->product_type}");

                } catch (\Exception $e) {
                    $this->error("Failed to send reminder {$reminder->id}: " . $e->getMessage());
                    Log::error("Failed to send eyewear reminder {$reminder->id}: " . $e->getMessage());
                }
            }

            $this->info("Completed: {$sentCount} sent, {$skippedCount} skipped");

            return Command::SUCCESS;
        } catch (\Exception $e) {
            $this->error("Failed to process reminders: " . $e->getMessage());
            Log::error("Failed to process eyewear reminders: " . $e->getMessage());
            return Command::FAILURE;
        }
    }

    /**
     * Send reminder notification to customer
     */
    private function sendReminderNotification(EyewearReminder $reminder): void
    {
        $user = $reminder->user;
        
        if (!$user) {
            throw new \Exception("User not found for reminder {$reminder->id}");
        }

        // Build message based on product type
        $productTypeLabel = match($reminder->product_type) {
            'frame' => 'eyewear frames',
            'prescription_lens' => 'prescription lenses',
            'contact_lens' => 'contact lenses',
            default => 'eyewear'
        };

        $title = "Eyewear Condition Check Reminder";
        $message = "It's time for a condition check on your {$productTypeLabel}. ";
        
        if ($reminder->product_type === 'contact_lens') {
            if ($reminder->contact_lens_expiry) {
                $daysUntilExpiry = Carbon::parse($reminder->contact_lens_expiry)->diffInDays(now());
                if ($daysUntilExpiry <= 7) {
                    $message = "Your contact lenses are expiring in {$daysUntilExpiry} day(s). Please replace them soon.";
                    $title = "Contact Lens Replacement Reminder";
                }
            } else {
                $message .= "Please check your contact lenses and replace if needed.";
            }
        } else {
            $message .= "Please inspect your {$productTypeLabel} for any scratches, damage, or issues. ";
            $message .= "You can submit a quick feedback form to let us know about the condition of your eyewear.";
        }
        
        // Add feedback form prompt
        $message .= "\n\nPlease fill out the feedback form to help us track your eyewear condition.";

        // Create notification
        $notification = Notification::create([
            'user_id' => $user->id,
            'role' => 'customer',
            'title' => $title,
            'message' => $message,
            'type' => 'eyewear_reminder',
            'data' => [
                'reminder_id' => $reminder->id,
                'product_type' => $reminder->product_type,
                'product_id' => $reminder->product_id,
                'next_reminder_date' => $reminder->next_reminder_date->toDateString(),
                'action_url' => '/customer/eyewear/condition-report',
            ]
        ]);

        // Send real-time notification via WebSocket
        try {
            WebSocketService::notifyUsers(
                $title,
                $message,
                'eyewear_reminder',
                [$user->id],
                $notification->data
            );
        } catch (\Exception $e) {
            Log::warning("Failed to send WebSocket notification for reminder {$reminder->id}: " . $e->getMessage());
        }

        Log::info("Eyewear reminder sent", [
            'reminder_id' => $reminder->id,
            'user_id' => $user->id,
            'product_type' => $reminder->product_type,
            'notification_id' => $notification->id
        ]);
    }
}
