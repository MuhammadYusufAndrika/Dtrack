<?php

namespace App\Services;

use App\Enums\DriverStatus;
use App\Models\Driver;
use App\Repositories\DriverRepository;
use Illuminate\Database\Eloquent\Collection;

class DriverService
{
    public function __construct(
        private DriverRepository $driverRepository,
    ) {}

    public function registerDriver(array $data): Driver
    {
        if (!isset($data['status'])) {
            $data['status'] = DriverStatus::AVAILABLE;
        }

        return $this->driverRepository->create($data);
    }

    public function updateDriver($id, array $data): Driver
    {
        $driver = $this->driverRepository->update($id, $data);
        return $driver;
    }

    public function getAvailableDrivers(): Collection
    {
        return $this->driverRepository->findAvailableDrivers();
    }

    public function getDriverHistory($id): ?Driver
    {
        return $this->driverRepository->getDriverWithHistory($id);
    }

    public function getDriverById($id): ?Driver
    {
        return $this->driverRepository->find($id);
    }

    public function getAllDrivers(): Collection
    {
        return $this->driverRepository->allWithVehicle();
    }

    public function deleteDriver($id): bool
    {
        return $this->driverRepository->delete($id);
    }
}
