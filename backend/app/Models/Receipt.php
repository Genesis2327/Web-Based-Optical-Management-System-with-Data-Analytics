<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Traits\Auditable;

class Receipt extends Model
{
    use HasFactory, Auditable;

    protected $fillable = [
        'receipt_number',
        'customer_id',
        'branch_id',
        'reservation_id',
        'appointment_id',
        'sales_type',
        'date',
        'customer_name',
        'tin',
        'address',
        'vatable_sales',
        'vat_amount',
        'zero_rated_sales',
        'vat_exempt_sales',
        'net_of_vat',
        'less_vat',
        'add_vat',
        'discount',
        'withholding_tax',
        'total_due',
        'payment_method',
        'payment_status',
    ];

    protected $casts = [
        'date' => 'date',
        'vatable_sales' => 'decimal:2',
        'vat_amount' => 'decimal:2',
        'zero_rated_sales' => 'decimal:2',
        'vat_exempt_sales' => 'decimal:2',
        'net_of_vat' => 'decimal:2',
        'less_vat' => 'decimal:2',
        'add_vat' => 'decimal:2',
        'discount' => 'decimal:2',
        'withholding_tax' => 'decimal:2',
        'total_due' => 'decimal:2',
    ];

    /**
     * Boot method to generate receipt number
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($receipt) {
            if (empty($receipt->receipt_number)) {
                $receipt->receipt_number = static::generateReceiptNumber($receipt->branch_id);
            }
        });
    }

    /**
     * Generate unique receipt number with branch code to prevent duplicates across branches
     * 
     * Format: REC-{BRANCH_CODE}-{YYYYMMDD}-{0001}
     * Example: REC-BR1-20251117-0001, REC-MAIN-20251117-0001
     * 
     * @param int|null $branchId The branch ID for this receipt
     * @return string Unique receipt number
     */
    public static function generateReceiptNumber($branchId = null): string
    {
        $date = now()->format('Ymd');
        
        // Get branch code if branch_id is provided
        $branchCode = 'MAIN'; // Default fallback
        if ($branchId) {
            $branch = Branch::find($branchId);
            if ($branch) {
                // Use branch code if available, otherwise use first 3 uppercase letters of name
                $branchCode = $branch->code 
                    ? strtoupper(substr($branch->code, 0, 3))
                    : strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $branch->name), 0, 3));
                
                // Ensure branch code is at least 3 characters
                if (strlen($branchCode) < 3) {
                    $branchCode = str_pad($branchCode, 3, 'X', STR_PAD_RIGHT);
                }
            }
        }
        
        $prefix = "REC-{$branchCode}-{$date}-";
        
        // Query for last receipt with same prefix (same branch and date)
        $query = static::where('receipt_number', 'like', $prefix . '%');
        
        // Also filter by branch_id if provided for extra safety
        if ($branchId) {
            $query->where('branch_id', $branchId);
        }
        
        $lastReceipt = $query->orderBy('receipt_number', 'desc')->first();
        
        if ($lastReceipt) {
            // Extract the last 4 digits from the receipt number
            $lastNumber = (int) substr($lastReceipt->receipt_number, -4);
            $newNumber = $lastNumber + 1;
        } else {
            $newNumber = 1;
        }
        
        return $prefix . str_pad($newNumber, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Get the customer for this receipt
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    /**
     * Get the branch for this receipt
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * Get the reservation for this receipt
     */
    public function reservation(): BelongsTo
    {
        return $this->belongsTo(Reservation::class);
    }

    /**
     * Get the appointment for this receipt
     */
    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }

    /**
     * Get the receipt items
     */
    public function items(): HasMany
    {
        return $this->hasMany(ReceiptItem::class);
    }

}
