<?php

return [

    'speed_threshold_kmh' => env('FLEETVISION_SPEED_THRESHOLD', 120),

    'max_driving_duration_seconds' => env('FLEETVISION_MAX_DRIVING_DURATION', 14400),

    'location_polling_interval' => env('FLEETVISION_LOCATION_POLLING_INTERVAL', 5),

    'alert_retention_days' => env('FLEETVISION_ALERT_RETENTION_DAYS', 90),

];
