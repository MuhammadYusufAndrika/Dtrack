<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('driver_statuses', function (Blueprint $table) {
            $table->boolean('smoking')->default(false)->after('phone_usage');
        });
    }

    public function down(): void
    {
        Schema::table('driver_statuses', function (Blueprint $table) {
            $table->dropColumn('smoking');
        });
    }
};
