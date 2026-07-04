<?php

namespace App\Repositories;

use App\Models\DrivingSession;
use Carbon\Carbon;

class DrivingSessionRepository extends BaseRepository
{
    protected function modelClass(): string
    {
        return DrivingSession::class;
    }

    public function findActiveByVehicle($vehicleId): ?DrivingSession
    {
        return DrivingSession::where('vehicle_id', $vehicleId)
            ->where('is_active', true)
            ->first();
    }

    public function findActiveByDriver($driverId): ?DrivingSession
    {
        return DrivingSession::where('driver_id', $driverId)
            ->where('is_active', true)
            ->first();
    }

    public function getDriverSessions($driverId, int $limit = 20)
    {
        return DrivingSession::where('driver_id', $driverId)
            ->latest()
            ->limit($limit)
            ->get();
    }

    public function getVehicleSessions($vehicleId, int $limit = 20)
    {
        return DrivingSession::where('vehicle_id', $vehicleId)
            ->latest()
            ->limit($limit)
            ->get();
    }

    public function getSessionsExceedingDuration(int $maxSeconds): \Illuminate\Database\Eloquent\Collection
    {
        return DrivingSession::where('is_active', true)
            ->where('driving_duration_seconds', '>=', $maxSeconds)
            ->get();
    }

    public function endAllActiveSessions(): int
    {
        return DrivingSession::where('is_active', true)
            ->update([
                'is_active' => false,
                'end_time' => Carbon::now(),
            ]);
    }
}
