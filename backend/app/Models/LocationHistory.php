<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LocationHistory extends Model
{
    use HasFactory;

    protected $fillable = [
        'vehicle_id',
        'driving_session_id',
        'latitude',
        'longitude',
        'speed',
        'heading',
        'accuracy',
        'timestamp',
    ];

    protected $casts = [
        'latitude' => 'decimal:7',
        'longitude' => 'decimal:7',
        'speed' => 'float',
        'heading' => 'float',
        'accuracy' => 'float',
        'timestamp' => 'datetime',
    ];

    public $timestamps = false;

    protected $dates = ['created_at'];

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function drivingSession(): BelongsTo
    {
        return $this->belongsTo(DrivingSession::class);
    }
}
