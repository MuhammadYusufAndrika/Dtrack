<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DriverStatusChanged implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $driver_id,
        public array $statusData,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new Channel("driver.{$this->driver_id}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'driver.status.changed';
    }
}
