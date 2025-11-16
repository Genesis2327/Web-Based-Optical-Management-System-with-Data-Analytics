<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class BranchContact extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'branch_id',
        'phone_number',
        'email',
        'facebook_url',
        'instagram_url',
        'twitter_url',
        'linkedin_url',
        'whatsapp_number',
        'address',
        'operating_hours',
        'is_active'
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * Get the branch that owns the contact information.
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * Get formatted phone number for display.
     */
    public function getFormattedPhoneAttribute(): string
    {
        if (!$this->phone_number) {
            return '';
        }
        
        // Format phone number (assuming format: +63XXXXXXXXXX)
        $phone = preg_replace('/[^0-9+]/', '', $this->phone_number);
        if (strlen($phone) === 13 && str_starts_with($phone, '+63')) {
            return '+63 ' . substr($phone, 3, 3) . ' ' . substr($phone, 6, 3) . ' ' . substr($phone, 9);
        }
        
        return $this->phone_number;
    }

    /**
     * Get formatted WhatsApp number for display.
     */
    public function getFormattedWhatsappAttribute(): string
    {
        if (!$this->whatsapp_number) {
            return '';
        }
        
        $whatsapp = preg_replace('/[^0-9+]/', '', $this->whatsapp_number);
        if (strlen($whatsapp) === 13 && str_starts_with($whatsapp, '+63')) {
            return '+63 ' . substr($whatsapp, 3, 3) . ' ' . substr($whatsapp, 6, 3) . ' ' . substr($whatsapp, 9);
        }
        
        return $this->whatsapp_number;
    }

    /**
     * Get WhatsApp link for direct messaging.
     */
    public function getWhatsappLinkAttribute(): string
    {
        if (!$this->whatsapp_number) {
            return '';
        }
        
        $number = preg_replace('/[^0-9]/', '', $this->whatsapp_number);
        return "https://wa.me/{$number}";
    }

    /**
     * Get all social media links as array.
     */
    public function getSocialMediaLinksAttribute(): array
    {
        $links = [];
        
        if ($this->facebook_url) {
            $links['facebook'] = $this->facebook_url;
        }
        
        if ($this->instagram_url) {
            $links['instagram'] = $this->instagram_url;
        }
        
        if ($this->twitter_url) {
            $links['twitter'] = $this->twitter_url;
        }
        
        if ($this->linkedin_url) {
            $links['linkedin'] = $this->linkedin_url;
        }
        
        return $links;
    }

    /**
     * Scope to get only active contacts.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
