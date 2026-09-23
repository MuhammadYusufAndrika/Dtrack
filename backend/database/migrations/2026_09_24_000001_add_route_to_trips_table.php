<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('trips', function (Blueprint $table) {
            // Rute yang diinput admin (titik awal = start_latitude/longitude,
            // titik tujuan = dest_latitude/longitude).
            $table->string('origin')->nullable()->after('driver_id');
            $table->string('destination')->nullable()->after('origin');
            $table->decimal('dest_latitude', 10, 7)->nullable()->after('end_longitude');
            $table->decimal('dest_longitude', 10, 7)->nullable()->after('dest_latitude');
            // Estimasi jarak rencana (haversine/OSRM saat admin membuat trip).
            // Jarak aktual tempuh tetap di total_distance_km.
            $table->decimal('planned_distance_km', 10, 2)->nullable()->after('total_distance_km');
        });
    }

    public function down(): void
    {
        Schema::table('trips', function (Blueprint $table) {
            $table->dropColumn(['origin', 'destination', 'dest_latitude', 'dest_longitude', 'planned_distance_km']);
        });
    }
};
