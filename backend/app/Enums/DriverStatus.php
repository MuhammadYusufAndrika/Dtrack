<?php

namespace App\Enums;

enum DriverStatus: string
{
    case AVAILABLE = 'available';
    case DRIVING = 'driving';
    case OFF_DUTY = 'off_duty';
    case ON_BREAK = 'on_break';
}
