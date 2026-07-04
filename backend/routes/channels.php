<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('vehicle.{id}', function ($user, $id) {
    return true;
});

Broadcast::channel('driver.{id}', function ($user, $id) {
    return true;
});

Broadcast::channel('alerts', function ($user) {
    return true;
});
