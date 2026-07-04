<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LocationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'vehicle_id' => $this->vehicle_id,
            'driving_session_id' => $this->driving_session_id,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'speed' => $this->speed,
            'heading' => $this->heading,
            'accuracy' => $this->accuracy,
            'timestamp' => $this->timestamp,
        ];
    }

    public static function collection($resource)
    {
        return parent::collection($resource)->additional([
            'success' => true,
            'message' => 'Locations retrieved successfully.',
        ]);
    }
}
