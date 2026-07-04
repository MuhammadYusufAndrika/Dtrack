<?php

namespace App\Repositories;

use App\Models\DriverStatus;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;

class DriverStatusRepository extends BaseRepository
{
    protected function modelClass(): string
    {
        return DriverStatus::class;
    }

    public function getLatestForDriver($driverId): ?DriverStatus
    {
        return DriverStatus::where('driver_id', $driverId)
            ->latest('timestamp')
            ->first();
    }

    public function getHistoryForDriver($driverId, int $limit = 50): Collection
    {
        return DriverStatus::where('driver_id', $driverId)
            ->latest('timestamp')
            ->limit($limit)
            ->get();
    }

    public function getStatusBySession($sessionId): Collection
    {
        return DriverStatus::where('driving_session_id', $sessionId)
            ->orderBy('timestamp')
            ->get();
    }
}
