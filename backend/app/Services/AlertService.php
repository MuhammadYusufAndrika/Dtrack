<?php

namespace App\Services;

use App\Events\AlertTriggered;
use App\Models\Alert;
use App\Repositories\AlertRepository;
use Illuminate\Database\Eloquent\Collection;

class AlertService
{
    public function __construct(
        private AlertRepository $alertRepository,
    ) {}

    public function createAlert(array $data): Alert
    {
        $alert = $this->alertRepository->create($data);

        broadcast(new AlertTriggered($alert->toArray()))->toOthers();

        return $alert;
    }

    public function markAsRead($id): Alert
    {
        return $this->alertRepository->markAsRead($id);
    }

    public function getActiveAlerts(): Collection
    {
        return $this->alertRepository->findActiveAlerts();
    }

    public function getVehicleAlerts($vehicleId): Collection
    {
        return $this->alertRepository->getVehicleAlerts($vehicleId);
    }

    public function getAlertById($id): ?Alert
    {
        return $this->alertRepository->find($id);
    }

    public function getAllAlerts(): Collection
    {
        return $this->alertRepository->query()
            ->with(['vehicle', 'driver'])
            ->latest()
            ->get();
    }
}
