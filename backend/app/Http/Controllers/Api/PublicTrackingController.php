<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Repositories\VehicleRepository;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PublicTrackingController extends Controller
{
    public function __construct(
        private VehicleRepository $vehicleRepository,
    ) {}

    public function track(string $plateNumber): JsonResponse
    {
        $vehicle = $this->vehicleRepository->findByPlateNumber($plateNumber);

        if (!$vehicle) {
            return response()->json([
                'success' => false,
                'message' => 'Kendaraan tidak ditemukan.',
                'data' => null,
            ], 404);
        }

        $vehicle->load(['latestLocation', 'activeSession']);

        $latestLocation = $vehicle->latestLocation;

        // Trip aktif (berjalan) atau terjadwal (rencana admin) untuk kendaraan ini.
        $activeTrip = \App\Models\Trip::where('vehicle_id', $vehicle->id)
            ->whereIn('status', ['IN_PROGRESS', 'PLANNED'])
            ->orderByRaw("FIELD(status, 'IN_PROGRESS', 'PLANNED')")
            ->latest()
            ->first();

        return response()->json([
            'success' => true,
            'message' => 'Kendaraan ditemukan.',
            'data' => [
                'id' => $vehicle->id,
                'plate_number' => $vehicle->plate_number,
                'vehicle_id' => $vehicle->vehicle_id,
                'brand' => $vehicle->brand,
                'model' => $vehicle->model,
                'year' => $vehicle->year,
                'type' => $vehicle->type,
                'status' => $vehicle->status->value,
                'is_driving' => $vehicle->activeSession !== null,
                'latest_location' => $latestLocation ? [
                    'latitude' => $latestLocation->latitude,
                    'longitude' => $latestLocation->longitude,
                    'speed' => $latestLocation->speed,
                    'heading' => $latestLocation->heading,
                    'timestamp' => $latestLocation->timestamp,
                ] : null,
                'active_trip' => $activeTrip ? [
                    'id' => $activeTrip->id,
                    'status' => $activeTrip->status,
                    'origin' => $activeTrip->origin,
                    'destination' => $activeTrip->destination,
                    'start_latitude' => $activeTrip->start_latitude,
                    'start_longitude' => $activeTrip->start_longitude,
                    'dest_latitude' => $activeTrip->dest_latitude,
                    'dest_longitude' => $activeTrip->dest_longitude,
                    'planned_distance_km' => $activeTrip->planned_distance_km,
                    'total_distance_km' => $activeTrip->total_distance_km,
                    'distance_km' => $activeTrip->distance_km,
                ] : null,
            ],
        ]);
    }
}
