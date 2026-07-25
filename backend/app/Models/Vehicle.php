<?php

namespace App\Models;

use App\Enums\VehicleStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Vehicle extends Model
{
    use HasFactory;

    protected $fillable = [
        'plate_number',
        'vehicle_id',
        'brand',
        'model',
        'year',
        'type',
        'status',
        'driver_id',
    ];

    protected $casts = [
        'status' => VehicleStatus::class,
        'year' => 'integer',
    ];

    public function locationHistories(): HasMany
    {
        return $this->hasMany(LocationHistory::class);
    }

    public function drivingSessions(): HasMany
    {
        return $this->hasMany(DrivingSession::class);
    }

    public function alerts(): HasMany
    {
        return $this->hasMany(Alert::class);
    }

    public function latestLocation()
    {
        return $this->hasOne(LocationHistory::class)->latestOfMany();
    }

    public function activeSession()
    {
        return $this->hasOne(DrivingSession::class)->where('is_active', true);
    }

    public function scopeActive($query)
    {
        return $query->where('status', VehicleStatus::ACTIVE);
    }
}
