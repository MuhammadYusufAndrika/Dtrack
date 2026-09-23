<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Trip extends Model
{
    use HasFactory;

    protected $fillable = [
        'vehicle_id',
        'driver_id',
        'origin',
        'destination',
        'start_time',
        'end_time',
        'start_latitude',
        'start_longitude',
        'end_latitude',
        'end_longitude',
        'dest_latitude',
        'dest_longitude',
        'total_distance_km',
        'planned_distance_km',
        'status',
    ];

    protected $casts = [
        'start_time' => 'datetime',
        'end_time' => 'datetime',
        'start_latitude' => 'decimal:7',
        'start_longitude' => 'decimal:7',
        'end_latitude' => 'decimal:7',
        'end_longitude' => 'decimal:7',
        'dest_latitude' => 'decimal:7',
        'dest_longitude' => 'decimal:7',
        'total_distance_km' => 'decimal:2',
        'planned_distance_km' => 'decimal:2',
    ];

    // Kompatibilitas frontend (Admin/Trips.jsx, Driver/Trips.jsx pakai t.distance_km):
    // trip selesai -> jarak aktual, selain itu -> estimasi rencana.
    protected $appends = ['distance_km'];

    public function getDistanceKmAttribute(): ?float
    {
        if ($this->status === 'COMPLETED' && (float) $this->total_distance_km > 0) {
            return (float) $this->total_distance_km;
        }
        if ($this->planned_distance_km !== null) {
            return (float) $this->planned_distance_km;
        }
        return (float) $this->total_distance_km;
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class);
    }

    public function drivingSessions(): HasMany
    {
        return $this->hasMany(DrivingSession::class);
    }
}
