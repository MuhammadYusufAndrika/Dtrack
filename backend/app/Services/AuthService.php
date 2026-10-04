<?php

namespace App\Services;

use App\Enums\DriverStatus;
use App\Models\Driver;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthService
{
    public function login(array $credentials): array
    {
        $user = User::where('email', $credentials['email'])->first();

        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if ($user->isDriver() && !$user->is_approved) {
            throw ValidationException::withMessages([
                'email' => ['Akun Anda menunggu persetujuan admin.'],
            ]);
        }

        $token = $user->createToken('api-token')->plainTextToken;

        return [
            'user' => $user,
            'token' => $token,
        ];
    }

    /**
     * Pendaftaran mandiri sopir. Akun dibuat BELUM disetujui + profil
     * driver dibuat sekalian. Token TIDAK diterbitkan sampai admin approve
     * (login juga diblokir), jadi akun pending tidak bisa dipakai apa pun.
     */
    public function register(array $data): array
    {
        return DB::transaction(function () use ($data) {
            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => $data['password'],
                'role' => 'driver', // paksa: publik tidak boleh daftar admin
                'is_approved' => false,
            ]);

            $driver = Driver::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
                'license_number' => $data['license_number'] ?? null,
                'status' => DriverStatus::AVAILABLE,
            ]);

            return [
                'user' => $user,
                'driver' => $driver,
                'token' => null,
            ];
        });
    }

    public function logout(User $user): void
    {
        $user->currentAccessToken()->delete();
    }

    public function me(User $user): User
    {
        return $user;
    }
}
