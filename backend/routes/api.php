<?php

use App\Http\Controllers\Api\AIController;
use App\Http\Controllers\Api\AlertController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DriverController;
use App\Http\Controllers\Api\LocationController;
use App\Http\Controllers\Api\PublicTrackingController;
use App\Http\Controllers\Api\TripController;
use App\Http\Controllers\Api\VehicleController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/register', [AuthController::class, 'register']);

Route::get('/public/track/{plateNumber}', [PublicTrackingController::class, 'track']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::apiResource('vehicles', VehicleController::class);
    Route::apiResource('drivers', DriverController::class);
    Route::apiResource('trips', TripController::class);
    Route::apiResource('alerts', AlertController::class)->only(['index', 'show']);

    Route::post('/location', [LocationController::class, 'store']);
    Route::post('/ai/result', [AIController::class, 'store']);

    Route::get('/vehicles/{vehicle}/locations', [VehicleController::class, 'getLocations']);
    Route::get('/drivers/{driver}/status', [DriverController::class, 'getStatus']);
    Route::get('/alerts/active', [AlertController::class, 'getActive']);
    Route::patch('/alerts/{alert}/read', [AlertController::class, 'markAsRead']);

    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);
});
