<?php

namespace App\Services;

use App\Enums\AlertSeverity;
use App\Enums\AlertType;
use App\Enums\DriverStatus;
use App\Models\DrivingSession;
use App\Repositories\DrivingSessionRepository;
use App\Repositories\DriverRepository;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class DrivingSessionService
{
    public function __construct(
        private DrivingSessionRepository $drivingSessionRepository,
        private DriverRepository $driverRepository,
        private AlertService $alertService,
    ) {}

    public function startSession(array $data): DrivingSession
    {
        return DB::transaction(function () use ($data) {
            $existingSession = $this->drivingSessionRepository->findActiveByVehicle($data['vehicle_id']);
            if ($existingSession) {
                throw new \RuntimeException('Vehicle already has an active driving session.');
            }

            $existingDriverSession = $this->drivingSessionRepository->findActiveByDriver($data['driver_id']);
            if ($existingDriverSession) {
                throw new \RuntimeException('Driver already has an active driving session.');
            }

            $session = $this->drivingSessionRepository->create([
                'vehicle_id' => $data['vehicle_id'],
                'driver_id' => $data['driver_id'],
                'start_time' => Carbon::now(),
                'start_latitude' => $data['start_latitude'] ?? null,
                'start_longitude' => $data['start_longitude'] ?? null,
                'current_latitude' => $data['start_latitude'] ?? null,
                'current_longitude' => $data['start_longitude'] ?? null,
                'is_active' => true,
            ]);

            $this->driverRepository->update($data['driver_id'], [
                'status' => DriverStatus::DRIVING,
            ]);

            return $session;
        });
    }

    public function endSession($id): DrivingSession
    {
        return DB::transaction(function () use ($id) {
            $session = $this->drivingSessionRepository->findOrFail($id);

            if (!$session->is_active) {
                throw new \RuntimeException('Session is already ended.');
            }

            $endTime = Carbon::now();
            $duration = Carbon::parse($session->start_time)->diffInSeconds($endTime);

            $session->update([
                'is_active' => false,
                'end_time' => $endTime,
                'driving_duration_seconds' => $duration,
            ]);

            $this->driverRepository->update($session->driver_id, [
                'status' => DriverStatus::AVAILABLE,
            ]);

            return $session->fresh();
        });
    }

    public function getActiveSession($vehicleId): ?DrivingSession
    {
        return $this->drivingSessionRepository->findActiveByVehicle($vehicleId);
    }

    public function checkDrivingDuration(): void
    {
        $maxDurationSeconds = config('fleetvision.max_driving_duration_seconds', 14400); // 4 hours

        $sessions = $this->drivingSessionRepository->getSessionsExceedingDuration($maxDurationSeconds);

        foreach ($sessions as $session) {
            $hours = floor($session->driving_duration_seconds / 3600);
            $minutes = floor(($session->driving_duration_seconds % 3600) / 60);

            $this->alertService->createAlert([
                'vehicle_id' => $session->vehicle_id,
                'driver_id' => $session->driver_id,
                'driving_session_id' => $session->id,
                'type' => AlertType::DRIVING_TIME,
                'severity' => AlertSeverity::HIGH,
                'message' => "Driver has been driving for {$hours}h {$minutes}m. Exceeded maximum allowed duration.",
            ]);
        }
    }
}
