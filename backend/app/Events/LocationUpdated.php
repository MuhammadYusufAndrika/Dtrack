<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class LocationUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $vehicle_id,
        public float $latitude,
        public float $longitude,
        public float $speed,
        public float $heading,
        public string $timestamp,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new Channel("vehicle.{$this->vehicle_id}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'location.updated';
    }
}
