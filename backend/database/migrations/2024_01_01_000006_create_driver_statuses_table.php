<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('driver_statuses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_id')->constrained()->cascadeOnDelete();
            $table->foreignId('driving_session_id')->nullable()->constrained()->cascadeOnDelete();
            $table->boolean('seatbelt')->default(true);
            $table->boolean('fatigue')->default(false);
            $table->boolean('phone_usage')->default(false);
            $table->float('eye_closed')->default(0);
            $table->boolean('yawning')->default(false);
            $table->boolean('looking_away')->default(false);
            $table->dateTime('timestamp');
            $table->timestamp('created_at')->useCurrent();

            $table->index(['driver_id', 'timestamp']);
            $table->index('driving_session_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('driver_statuses');
    }
};
