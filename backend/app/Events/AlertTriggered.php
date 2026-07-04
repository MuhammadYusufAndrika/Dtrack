<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class AlertTriggered implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public array $alert,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new Channel('alerts'),
        ];
    }

    public function broadcastAs(): string
    {
        return 'alert.triggered';
    }
}
