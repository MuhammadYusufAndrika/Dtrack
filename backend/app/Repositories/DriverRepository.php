<?php

namespace App\Repositories;

use App\Models\Driver;
use Illuminate\Database\Eloquent\Collection;

class DriverRepository extends BaseRepository
{
    protected function modelClass(): string
    {
        return Driver::class;
    }

    public function findByEmail(string $email): ?Driver
    {
        return Driver::where('email', $email)->first();
    }

    public function findByLicenseNumber(string $licenseNumber): ?Driver
    {
        return Driver::where('license_number', $licenseNumber)->first();
    }

    public function allWithVehicle(): Collection
    {
        return Driver::with('vehicle')->get();
    }

    public function findAvailableDrivers(): Collection
    {
        return Driver::available()->get();
    }

    public function getDriverWithHistory($id): ?Driver
    {
        return Driver::with(['drivingSessions' => function ($query) {
            $query->latest()->limit(10);
        }, 'latestStatus'])->find($id);
    }

    public function countActive(): int
    {
        return Driver::where('status', \App\Enums\DriverStatus::DRIVING)->count();
    }

    public function countTotal(): int
    {
        return Driver::count();
    }
}
