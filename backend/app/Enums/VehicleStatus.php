<?php

namespace App\Enums;

enum VehicleStatus: string
{
    case ACTIVE = 'active';
    case INACTIVE = 'inactive';
    case MAINTENANCE = 'maintenance';
    case OUT_OF_SERVICE = 'out_of_service';
}
