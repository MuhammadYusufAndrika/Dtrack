<?php

namespace App\Http\Resources;

use App\Enums\AlertSeverity;
use App\Enums\AlertType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AlertResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'vehicle_id' => $this->vehicle_id,
            'driver_id' => $this->driver_id,
            'driving_session_id' => $this->driving_session_id,
            'type' => $this->type instanceof AlertType ? $this->type->value : $this->type,
            'severity' => $this->severity instanceof AlertSeverity ? $this->severity->value : $this->severity,
            'message' => $this->message,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'speed' => $this->speed,
            'is_read' => $this->is_read,
            'read_at' => $this->read_at,
            'vehicle' => $this->whenLoaded('vehicle', function () {
                return [
                    'id' => $this->vehicle->id,
                    'plate_number' => $this->vehicle->plate_number,
                    'vehicle_id' => $this->vehicle->vehicle_id,
                ];
            }),
            'driver' => $this->whenLoaded('driver', function () {
                return [
                    'id' => $this->driver->id,
                    'name' => $this->driver->name,
                ];
            }),
            'created_at' => $this->created_at,
        ];
    }

    public static function collection($resource)
    {
        return parent::collection($resource)->additional([
            'success' => true,
            'message' => 'Alerts retrieved successfully.',
        ]);
    }
}
