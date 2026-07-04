<?php

namespace App\Repositories;

use App\Models\Trip;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;

class TripRepository extends BaseRepository
{
    protected function modelClass(): string
    {
        return Trip::class;
    }

    public function findActiveTrips(): Collection
    {
        return Trip::where('status', 'IN_PROGRESS')->with(['vehicle', 'driver'])->get();
    }

    public function getTripHistory($vehicleId = null, $driverId = null): Collection
    {
        $query = Trip::with(['vehicle', 'driver']);

        if ($vehicleId) {
            $query->where('vehicle_id', $vehicleId);
        }

        if ($driverId) {
            $query->where('driver_id', $driverId);
        }

        return $query->latest()->limit(50)->get();
    }

    public function getTodayTripsCount(): int
    {
        return Trip::whereDate('created_at', Carbon::today())->count();
    }

    public function getTodayTotalDistance(): float
    {
        return (float) Trip::whereDate('created_at', Carbon::today())
            ->where('status', 'COMPLETED')
            ->sum('total_distance_km');
    }
}
