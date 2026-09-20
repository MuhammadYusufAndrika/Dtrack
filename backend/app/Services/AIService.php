<?php

namespace App\Services;

use App\Enums\AlertSeverity;
use App\Enums\AlertType;
use App\Events\DriverStatusChanged;
use App\Models\DriverStatus;
use App\Repositories\DriverStatusRepository;
use App\Repositories\DrivingSessionRepository;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class AIService
{
    public function __construct(
        private DriverStatusRepository $driverStatusRepository,
        private DrivingSessionRepository $drivingSessionRepository,
        private AlertService $alertService,
    ) {}

    public function processAIResult(int $vehicleId, array $data): DriverStatus
    {
        $session = $this->drivingSessionRepository->findActiveByVehicle($vehicleId);

        $timestamp = isset($data['timestamp'])
            ? Carbon::parse($data['timestamp'])
            : Carbon::now();

        $statusData = [
            'driver_id' => $session?->driver_id,
            'driving_session_id' => $session?->id,
            'seatbelt' => $data['seatbelt'] ?? true,
            'phone_usage' => $data['phone_usage'] ?? false,
            'smoking' => $data['smoking'] ?? false,
            'looking_away' => $data['looking_away'] ?? false,
            'timestamp' => $timestamp,
        ];

        $driverStatus = $this->driverStatusRepository->create($statusData);

        if ($session && $session->driver_id) {
            broadcast(new DriverStatusChanged(
                driverId: $session->driver_id,
                statusData: $statusData,
            ))->toOthers();
        }

        if (isset($data['seatbelt']) && $data['seatbelt'] === false) {
            $this->alertService->createAlert([
                'vehicle_id' => $vehicleId,
                'driver_id' => $session?->driver_id,
                'driving_session_id' => $session?->id,
                'type' => AlertType::SEATBELT,
                'severity' => AlertSeverity::HIGH,
                'message' => 'Driver seatbelt is not fastened',
                'latitude' => $data['latitude'] ?? null,
                'longitude' => $data['longitude'] ?? null,
            ]);
        }

        if (isset($data['smoking']) && $data['smoking'] === true) {
            $this->alertService->createAlert([
                'vehicle_id' => $vehicleId,
                'driver_id' => $session?->driver_id,
                'driving_session_id' => $session?->id,
                'type' => AlertType::SMOKING,
                'severity' => AlertSeverity::HIGH,
                'message' => 'Driver smoking detected',
                'latitude' => $data['latitude'] ?? null,
                'longitude' => $data['longitude'] ?? null,
            ]);
        }

        if (isset($data['phone_usage']) && $data['phone_usage'] === true) {
            $this->alertService->createAlert([
                'vehicle_id' => $vehicleId,
                'driver_id' => $session?->driver_id,
                'driving_session_id' => $session?->id,
                'type' => AlertType::PHONE_USAGE,
                'severity' => AlertSeverity::MEDIUM,
                'message' => 'Driver using phone while driving',
                'latitude' => $data['latitude'] ?? null,
                'longitude' => $data['longitude'] ?? null,
            ]);
        }

        return $driverStatus;
    }
}
