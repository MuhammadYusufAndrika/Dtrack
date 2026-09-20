<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DriverResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'license_number' => $this->license_number,
            'status' => $this->status,
            'photo_url' => $this->photo_url,
            'vehicle' => $this->whenLoaded('vehicle', function () {
                return $this->vehicle ? [
                    'id' => $this->vehicle->id,
                    'plate_number' => $this->vehicle->plate_number,
                    'brand' => $this->vehicle->brand,
                    'model' => $this->vehicle->model,
                    'vehicle_id' => $this->vehicle->vehicle_id,
                ] : null;
            }),
            'latest_status' => $this->whenLoaded('latestStatus', function () {
                return $this->latestStatus ? [
                    'seatbelt' => $this->latestStatus->seatbelt,
                    'fatigue' => $this->latestStatus->fatigue,
                    'phone_usage' => $this->latestStatus->phone_usage,
                    'eye_closed' => $this->latestStatus->eye_closed,
                    'yawning' => $this->latestStatus->yawning,
                    'looking_away' => $this->latestStatus->looking_away,
                    'timestamp' => $this->latestStatus->timestamp,
                ] : null;
            }),
            'recent_sessions' => $this->whenLoaded('drivingSessions', function () {
                return $this->drivingSessions->map(fn($s) => [
                    'id' => $s->id,
                    'vehicle_id' => $s->vehicle_id,
                    'start_time' => $s->start_time,
                    'end_time' => $s->end_time,
                    'total_distance_km' => $s->total_distance_km,
                    'is_active' => $s->is_active,
                ]);
            }),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }

    public static function collection($resource)
    {
        return parent::collection($resource)->additional([
            'success' => true,
            'message' => 'Drivers retrieved successfully.',
        ]);
    }
}
