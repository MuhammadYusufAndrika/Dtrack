<?php

namespace App\Repositories;

use App\Models\Alert;
use Illuminate\Database\Eloquent\Collection;

class AlertRepository extends BaseRepository
{
    protected function modelClass(): string
    {
        return Alert::class;
    }

    public function findActiveAlerts(): Collection
    {
        return Alert::where('is_read', false)
            ->with(['vehicle', 'driver'])
            ->latest()
            ->get();
    }

    public function getVehicleAlerts($vehicleId): Collection
    {
        return Alert::where('vehicle_id', $vehicleId)
            ->with(['vehicle', 'driver'])
            ->latest()
            ->limit(50)
            ->get();
    }

    public function getDriverAlerts($driverId): Collection
    {
        return Alert::where('driver_id', $driverId)
            ->with(['vehicle', 'driver'])
            ->latest()
            ->limit(50)
            ->get();
    }

    public function countActive(): int
    {
        return Alert::where('is_read', false)->count();
    }

    public function markAsRead($id): ?Alert
    {
        $alert = $this->findOrFail($id);
        $alert->update([
            'is_read' => true,
            'read_at' => now(),
        ]);
        return $alert->fresh();
    }

    public function markAllAsReadForVehicle($vehicleId): int
    {
        return Alert::where('vehicle_id', $vehicleId)
            ->where('is_read', false)
            ->update([
                'is_read' => true,
                'read_at' => now(),
            ]);
    }
}
