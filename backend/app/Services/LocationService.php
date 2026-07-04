<?php

namespace App\Services;

use App\Enums\AlertSeverity;
use App\Enums\AlertType;
use App\Models\LocationHistory;
use App\Repositories\DrivingSessionRepository;
use App\Repositories\LocationHistoryRepository;
use App\Events\LocationUpdated;
use Carbon\Carbon;

class LocationService
{
    private const EARTH_RADIUS_KM = 6371;

    public function __construct(
        private LocationHistoryRepository $locationHistoryRepository,
        private DrivingSessionRepository $drivingSessionRepository,
        private AlertService $alertService,
    ) {}

    public function processLocationUpdate(int $vehicleId, array $data): LocationHistory
    {
        $timestamp = isset($data['timestamp'])
            ? Carbon::parse($data['timestamp'])
            : Carbon::now();

        $session = $this->drivingSessionRepository->findActiveByVehicle($vehicleId);

        $locationData = [
            'vehicle_id' => $vehicleId,
            'driving_session_id' => $session?->id,
            'latitude' => $data['latitude'],
            'longitude' => $data['longitude'],
            'speed' => $data['speed'] ?? 0,
            'heading' => $data['heading'] ?? 0,
            'accuracy' => $data['accuracy'] ?? 0,
            'timestamp' => $timestamp,
        ];

        $location = $this->locationHistoryRepository->create($locationData);

        if ($session) {
            $lastLocation = $this->locationHistoryRepository->getLatestForVehicle($vehicleId);
            $distance = 0;

            if ($lastLocation && $lastLocation->id !== $location->id) {
                $distance = $this->calculateDistance(
                    $lastLocation->latitude,
                    $lastLocation->longitude,
                    $data['latitude'],
                    $data['longitude']
                );
            } else {
                $previous = $session->only(['current_latitude', 'current_longitude']);
                if ($previous['current_latitude'] && $previous['current_longitude']) {
                    $distance = $this->calculateDistance(
                        $previous['current_latitude'],
                        $previous['current_longitude'],
                        $data['latitude'],
                        $data['longitude']
                    );
                }
            }

            $newTotalDistance = $session->total_distance_km + $distance;
            $currentDuration = $session->start_time
                ? Carbon::parse($session->start_time)->diffInSeconds($timestamp)
                : 0;

            $speed = $data['speed'] ?? 0;
            $newMaxSpeed = max($session->max_speed, $speed);
            $averageSpeed = $currentDuration > 0
                ? ($newTotalDistance / ($currentDuration / 3600))
                : 0;

            $session->update([
                'current_latitude' => $data['latitude'],
                'current_longitude' => $data['longitude'],
                'total_distance_km' => $newTotalDistance,
                'max_speed' => $newMaxSpeed,
                'average_speed' => $averageSpeed,
                'driving_duration_seconds' => $currentDuration,
            ]);
        }

        $speedThreshold = config('fleetvision.speed_threshold_kmh', 120);
        if (($data['speed'] ?? 0) > $speedThreshold) {
            $this->alertService->createAlert([
                'vehicle_id' => $vehicleId,
                'driving_session_id' => $session?->id,
                'type' => AlertType::SPEEDING,
                'severity' => AlertSeverity::MEDIUM,
                'message' => 'Vehicle exceeding speed limit: ' . round($data['speed'], 1) . ' km/h',
                'latitude' => $data['latitude'],
                'longitude' => $data['longitude'],
                'speed' => $data['speed'] ?? 0,
            ]);
        }

        broadcast(new LocationUpdated(
            vehicleId: $vehicleId,
            latitude: $data['latitude'],
            longitude: $data['longitude'],
            speed: $data['speed'] ?? 0,
            heading: $data['heading'] ?? 0,
            timestamp: $timestamp->toDateTimeString(),
        ))->toOthers();

        return $location;
    }

    private function calculateDistance(
        float $lat1, float $lon1,
        float $lat2, float $lon2
    ): float {
        $lat1 = deg2rad($lat1);
        $lon1 = deg2rad($lon1);
        $lat2 = deg2rad($lat2);
        $lon2 = deg2rad($lon2);

        $dlat = $lat2 - $lat1;
        $dlon = $lon2 - $lon1;

        $a = sin($dlat / 2) ** 2 +
            cos($lat1) * cos($lat2) * sin($dlon / 2) ** 2;

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return self::EARTH_RADIUS_KM * $c;
    }

    public function getLatestLocation(int $vehicleId): ?LocationHistory
    {
        return $this->locationHistoryRepository->getLatestForVehicle($vehicleId);
    }

    public function getHistoryInTimeRange(int $vehicleId, Carbon $from, Carbon $to)
    {
        return $this->locationHistoryRepository->getHistoryInTimeRange($vehicleId, $from, $to);
    }
}
