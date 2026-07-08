<?php

namespace App\Services;

use App\Models\Trip;
use App\Repositories\TripRepository;
use App\Repositories\DrivingSessionRepository;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class TripService
{
    public function __construct(
        private TripRepository $tripRepository,
        private DrivingSessionRepository $drivingSessionRepository,
        private DrivingSessionService $drivingSessionService,
    ) {}

    public function createTrip(array $data): Trip
    {
        $data['start_time'] = $data['start_time'] ?? Carbon::now();
        $data['status'] = 'PLANNED';

        return DB::transaction(function () use ($data) {
            return $this->tripRepository->create($data);
        });
    }

    public function startTrip($id): Trip
    {
        return DB::transaction(function () use ($id) {
            $trip = $this->tripRepository->findOrFail($id);

            if ($trip->status === 'IN_PROGRESS') {
                throw new \RuntimeException('Trip is already in progress.');
            }

            $trip->update([
                'status' => 'IN_PROGRESS',
                'start_time' => Carbon::now(),
                'start_latitude' => $trip->start_latitude,
                'start_longitude' => $trip->start_longitude,
                'end_time' => null,
                'end_latitude' => null,
                'end_longitude' => null,
                'total_distance_km' => 0,
            ]);

            $this->drivingSessionService->startSession([
                'vehicle_id' => $trip->vehicle_id,
                'driver_id' => $trip->driver_id,
                'start_latitude' => $trip->start_latitude,
                'start_longitude' => $trip->start_longitude,
                'trip_id' => $trip->id,
            ]);

            return $trip->fresh();
        });
    }

    public function endTrip($id, array $data = []): Trip
    {
        return DB::transaction(function () use ($id, $data) {
            $trip = $this->tripRepository->findOrFail($id);

            if ($trip->status === 'COMPLETED' || $trip->status === 'CANCELLED') {
                throw new \RuntimeException('Trip is already completed or cancelled.');
            }

            $session = $this->drivingSessionRepository->findActiveByVehicle($trip->vehicle_id);

            $endLat = $data['end_latitude'] ?? $session->current_latitude ?? $trip->end_latitude;
            $endLng = $data['end_longitude'] ?? $session->current_longitude ?? $trip->end_longitude;

            $trip->update([
                'status' => 'COMPLETED',
                'end_time' => Carbon::now(),
                'end_latitude' => $endLat,
                'end_longitude' => $endLng,
                'total_distance_km' => $session ? $session->total_distance_km : ($data['total_distance_km'] ?? 0),
            ]);

            if ($session) {
                $this->drivingSessionService->endSession($session->id);
            }

            return $trip->fresh();
        });
    }

    public function getActiveTrips(): Collection
    {
        return $this->tripRepository->findActiveTrips();
    }

    public function getTripHistory($vehicleId = null, $driverId = null): Collection
    {
        return $this->tripRepository->getTripHistory($vehicleId, $driverId);
    }

    public function getTripById($id): ?Trip
    {
        return $this->tripRepository->find($id);
    }

    public function getAllTrips(): Collection
    {
        return $this->tripRepository->query()
            ->with(['vehicle', 'driver'])
            ->latest()
            ->get();
    }
}
