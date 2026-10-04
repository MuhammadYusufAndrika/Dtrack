<?php

namespace App\Services;

use App\Enums\DriverStatus;
use App\Models\Driver;
use App\Models\User;
use App\Repositories\DriverRepository;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

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

    /**
     * Admin membuat sopir + akun login sekalian (langsung approved).
     */
    public function createDriverWithAccount(array $data): Driver
    {
        return DB::transaction(function () use ($data) {
            $driver = $this->registerDriver([
                'name' => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'],
                'license_number' => $data['license_number'],
            ]);

            User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => $data['password'],
                'role' => 'driver',
                'is_approved' => true,
            ]);

            return $driver;
        });
    }

    /**
     * Setujui sopir yang daftar mandiri. Mengembalikan password sementara
     * bila akun loginnya belum ada (kasus data lama).
     */
    public function approveDriver($id): array
    {
        return DB::transaction(function () use ($id) {
            $driver = $this->driverRepository->findOrFail($id);
            $tempPassword = null;

            $user = User::where('email', $driver->email)->first();
            if ($user) {
                $user->update(['is_approved' => true]);
            } else {
                $tempPassword = Str::random(12);
                User::create([
                    'name' => $driver->name,
                    'email' => $driver->email,
                    'password' => $tempPassword,
                    'role' => 'driver',
                    'is_approved' => true,
                ]);
            }

            return ['driver' => $driver->fresh(), 'temp_password' => $tempPassword];
        });
    }

    /** Sopir yang daftar mandiri dan belum disetujui. */
    public function getPendingDrivers(): Collection
    {
        $emails = User::where('role', 'driver')
            ->where('is_approved', false)
            ->pluck('email');
        return Driver::whereIn('email', $emails)->with('vehicle')->latest()->get();
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
        return DB::transaction(function () use ($id) {
            $driver = $this->driverRepository->findOrFail($id);
            // Hapus juga akun login + tokennya agar tidak jadi sampah bisa-login.
            $user = User::where('email', $driver->email)->first();
            if ($user) {
                $user->tokens()->delete();
                $user->delete();
            }
            return $this->driverRepository->delete($id);
        });
    }
}
