<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('driving_sessions', function (Blueprint $table) {
            // Tautkan sesi GPS ke trip (manual sopir maupun assign admin)
            // agar history perjalanan + jejak peta bisa dibuka per trip.
            $table->foreignId('trip_id')->nullable()->after('driver_id')
                ->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('driving_sessions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('trip_id');
        });
    }
};
