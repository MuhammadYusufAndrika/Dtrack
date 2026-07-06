<?php

namespace App\Services;

use App\Enums\VehicleStatus;
use App\Models\Vehicle;
use App\Repositories\VehicleRepository;
use Illuminate\Database\Eloquent\Collection;

class VehicleService
{
    public function __construct(
        private VehicleRepository $vehicleRepository,
    ) {}

    public function registerVehicle(array $data): Vehicle
    {
        if (!isset($data['status'])) {
            $data['status'] = VehicleStatus::ACTIVE;
        }

        return $this->vehicleRepository->create($data);
    }

    public function updateVehicle($id, array $data): Vehicle
    {
        return $this->vehicleRepository->update($id, $data);
    }

    public function getActiveVehicles(): Collection
    {
        return $this->vehicleRepository->findActiveVehicles();
    }

    public function getVehicleLocations($id): ?Vehicle
    {
        return $this->vehicleRepository->getVehicleWithCurrentLocation($id);
    }

    public function getVehicleById($id): ?Vehicle
    {
        return $this->vehicleRepository->find($id);
    }

    public function getAllVehicles(): Collection
    {
        return $this->vehicleRepository->getVehiclesWithLatestLocation();
    }

    public function deleteVehicle($id): bool
    {
        return $this->vehicleRepository->delete($id);
    }
}
