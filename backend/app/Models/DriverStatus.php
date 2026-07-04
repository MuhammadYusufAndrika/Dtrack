<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DriverStatus extends Model
{
    use HasFactory;

    protected $table = 'driver_statuses';

    protected $fillable = [
        'driver_id',
        'driving_session_id',
        'seatbelt',
        'fatigue',
        'phone_usage',
        'eye_closed',
        'yawning',
        'looking_away',
        'timestamp',
    ];

    protected $casts = [
        'seatbelt' => 'boolean',
        'fatigue' => 'boolean',
        'phone_usage' => 'boolean',
        'eye_closed' => 'float',
        'yawning' => 'boolean',
        'looking_away' => 'boolean',
        'timestamp' => 'datetime',
    ];

    public $timestamps = false;

    protected $dates = ['created_at'];

    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class);
    }

    public function drivingSession(): BelongsTo
    {
        return $this->belongsTo(DrivingSession::class);
    }
}
