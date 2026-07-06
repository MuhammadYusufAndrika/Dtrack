<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class VehicleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'plate_number' => $this->plate_number,
            'vehicle_id' => $this->vehicle_id,
            'brand' => $this->brand,
            'model' => $this->model,
            'year' => $this->year,
            'type' => $this->type,
            'status' => $this->status,
            'latest_location' => $this->whenLoaded('latestLocation', function () {
                return $this->latestLocation ? [
                    'latitude' => $this->latestLocation->latitude,
                    'longitude' => $this->latestLocation->longitude,
                    'speed' => $this->latestLocation->speed,
                    'heading' => $this->latestLocation->heading,
                    'timestamp' => $this->latestLocation->timestamp,
                ] : null;
            }),
            'active_session' => $this->whenLoaded('activeSession', function () {
                return $this->activeSession ? [
                    'id' => $this->activeSession->id,
                    'driver_id' => $this->activeSession->driver_id,
                    'start_time' => $this->activeSession->start_time,
                ] : null;
            }),
            'is_driving' => $this->relationLoaded('activeSession') && $this->activeSession !== null,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }

}
