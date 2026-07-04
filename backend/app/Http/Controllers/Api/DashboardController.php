<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Repositories\AlertRepository;
use App\Repositories\DriverRepository;
use App\Repositories\TripRepository;
use App\Repositories\VehicleRepository;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function __construct(
        private VehicleRepository $vehicleRepository,
        private DriverRepository $driverRepository,
        private AlertRepository $alertRepository,
        private TripRepository $tripRepository,
    ) {}

    public function stats(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Dashboard stats retrieved successfully.',
            'data' => [
                'total_vehicles' => $this->vehicleRepository->countTotal(),
                'active_vehicles' => $this->vehicleRepository->countActive(),
                'total_drivers' => $this->driverRepository->countTotal(),
                'active_drivers' => $this->driverRepository->countActive(),
                'active_alerts' => $this->alertRepository->countActive(),
                'today_trips' => $this->tripRepository->getTodayTripsCount(),
                'total_distance_today' => $this->tripRepository->getTodayTotalDistance(),
            ],
        ]);
    }
}
