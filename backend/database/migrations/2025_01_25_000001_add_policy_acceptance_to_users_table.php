<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('privacy_policy_accepted_at')->nullable()->after('is_protected');
            $table->string('privacy_policy_version')->nullable()->after('privacy_policy_accepted_at');
            $table->timestamp('terms_accepted_at')->nullable()->after('privacy_policy_version');
            $table->string('terms_version')->nullable()->after('terms_accepted_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'privacy_policy_accepted_at',
                'privacy_policy_version',
                'terms_accepted_at',
                'terms_version',
            ]);
        });
    }
};

