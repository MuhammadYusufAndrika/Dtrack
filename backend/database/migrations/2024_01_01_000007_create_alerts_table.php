<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->foreignId('driver_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('driving_session_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('type');
            $table->string('severity');
            $table->string('message');
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->float('speed')->nullable();
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index('is_read');
            $table->index('severity');
            $table->index(['vehicle_id', 'type']);
            $table->index('driver_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('alerts');
    }
};
