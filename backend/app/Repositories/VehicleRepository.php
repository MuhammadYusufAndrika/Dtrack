<?php

namespace App\Repositories;

use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Collection;

class VehicleRepository extends BaseRepository
{
    protected function modelClass(): string
    {
        return Vehicle::class;
    }

    public function findByPlateNumber(string $plateNumber): ?Vehicle
    {
        return Vehicle::where('plate_number', $plateNumber)->first();
    }

    public function findByVehicleId(string $vehicleId): ?Vehicle
    {
        return Vehicle::where('vehicle_id', $vehicleId)->first();
    }

    public function findActiveVehicles(): Collection
    {
        return Vehicle::active()->get();
    }

    public function getVehicleWithCurrentLocation($id): ?Vehicle
    {
        return Vehicle::with('latestLocation')->find($id);
    }

    public function getVehiclesWithLatestLocation(): Collection
    {
        return Vehicle::with(['latestLocation', 'activeSession'])->get();
    }

    public function countActive(): int
    {
        return Vehicle::active()->count();
    }

    public function countTotal(): int
    {
        return Vehicle::count();
    }
}
