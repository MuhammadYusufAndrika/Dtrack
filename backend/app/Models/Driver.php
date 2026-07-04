<?php

namespace App\Models;

use App\Enums\DriverStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Driver extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'email',
        'phone',
        'license_number',
        'status',
        'photo_url',
    ];

    protected $casts = [
        'status' => DriverStatus::class,
    ];

    public function drivingSessions(): HasMany
    {
        return $this->hasMany(DrivingSession::class);
    }

    public function alerts(): HasMany
    {
        return $this->hasMany(Alert::class);
    }

    public function vehicle(): HasOne
    {
        return $this->hasOne(Vehicle::class);
    }

    public function latestStatus()
    {
        return $this->hasOne(DriverStatus::class)->latestOfMany('timestamp');
    }

    public function scopeAvailable($query)
    {
        return $query->where('status', DriverStatus::AVAILABLE);
    }
}
