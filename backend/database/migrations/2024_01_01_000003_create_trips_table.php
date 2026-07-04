<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trips', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->foreignId('driver_id')->constrained()->cascadeOnDelete();
            $table->dateTime('start_time');
            $table->dateTime('end_time')->nullable();
            $table->decimal('start_latitude', 10, 7)->nullable();
            $table->decimal('start_longitude', 10, 7)->nullable();
            $table->decimal('end_latitude', 10, 7)->nullable();
            $table->decimal('end_longitude', 10, 7)->nullable();
            $table->decimal('total_distance_km', 10, 2)->default(0);
            $table->string('status'); // PLANNED, IN_PROGRESS, COMPLETED, CANCELLED
            $table->timestamps();

            $table->index('status');
            $table->index(['vehicle_id', 'driver_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trips');
    }
};
