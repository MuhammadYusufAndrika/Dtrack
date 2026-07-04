<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('location_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->foreignId('driving_session_id')->nullable()->constrained()->cascadeOnDelete();
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->float('speed')->default(0);
            $table->float('heading')->default(0);
            $table->float('accuracy')->default(0);
            $table->dateTime('timestamp');
            $table->timestamp('created_at')->useCurrent();

            $table->index(['vehicle_id', 'timestamp']);
            $table->index('driving_session_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('location_histories');
    }
};
