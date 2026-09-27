<?php

namespace App\Enums;

enum AlertType: string
{
    case FATIGUE = 'fatigue';
    case SEATBELT = 'seatbelt';
    case DISTRACTION = 'distraction';
    case SPEEDING = 'speeding';
    case DRIVING_TIME = 'driving_time';
    case PHONE_USAGE = 'phone_usage';
    case SMOKING = 'smoking';
}
