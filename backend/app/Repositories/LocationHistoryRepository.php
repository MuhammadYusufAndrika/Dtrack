<?php

namespace App\Repositories;

use App\Models\LocationHistory;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;

class LocationHistoryRepository extends BaseRepository
{
    protected function modelClass(): string
    {
        return LocationHistory::class;
    }

    public function getLatestForVehicle($vehicleId): ?LocationHistory
    {
        return LocationHistory::where('vehicle_id', $vehicleId)
            ->latest('timestamp')
            ->first();
    }

    public function getHistoryInTimeRange($vehicleId, Carbon $from, Carbon $to): Collection
    {
        return LocationHistory::where('vehicle_id', $vehicleId)
            ->whereBetween('timestamp', [$from, $to])
            ->orderBy('timestamp')
            ->get();
    }

    public function getHistoryBySession($sessionId): Collection
    {
        return LocationHistory::where('driving_session_id', $sessionId)
            ->orderBy('timestamp')
            ->get();
    }

    public function getLatestForAllVehicles(): Collection
    {
        $subquery = LocationHistory::selectRaw('MAX(id) as id')
            ->groupBy('vehicle_id');

        return LocationHistory::whereIn('id', $subquery)
            ->with('vehicle')
            ->get();
    }
}
