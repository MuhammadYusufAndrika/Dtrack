<?php

use App\Enums\VehicleStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicles', function (Blueprint $table) {
            $table->id();
            $table->string('plate_number');
            $table->string('vehicle_id')->unique();
            $table->string('brand');
            $table->string('model');
            $table->integer('year');
            $table->string('type');
            $table->string('status')->default(VehicleStatus::ACTIVE->value);
            $table->timestamps();

            $table->index('status');
            $table->index('plate_number');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicles');
    }
};
