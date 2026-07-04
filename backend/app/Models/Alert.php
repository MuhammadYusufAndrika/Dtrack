<?php

namespace App\Models;

use App\Enums\AlertSeverity;
use App\Enums\AlertType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Alert extends Model
{
    use HasFactory;

    protected $fillable = [
        'vehicle_id',
        'driver_id',
        'driving_session_id',
        'type',
        'severity',
        'message',
        'latitude',
        'longitude',
        'speed',
        'is_read',
        'read_at',
    ];

    protected $casts = [
        'type' => AlertType::class,
        'severity' => AlertSeverity::class,
        'latitude' => 'decimal:7',
        'longitude' => 'decimal:7',
        'speed' => 'float',
        'is_read' => 'boolean',
        'read_at' => 'datetime',
    ];

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class);
    }

    public function drivingSession(): BelongsTo
    {
        return $this->belongsTo(DrivingSession::class);
    }

    public function scopeUnread($query)
    {
        return $query->where('is_read', false);
    }

    public function scopeBySeverity($query, AlertSeverity $severity)
    {
        return $query->where('severity', $severity);
    }
}
