<?php

namespace Database\Seeders;

use App\Enums\DriverStatus;
use App\Enums\VehicleStatus;
use App\Models\Alert;
use App\Models\Driver;
use App\Models\DrivingSession;
use App\Models\LocationHistory;
use App\Models\Trip;
use App\Models\Vehicle;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $vehicles = collect();
        $vehicleData = [
            ['plate_number' => 'ABC-1234', 'vehicle_id' => 'TRK001', 'brand' => 'Volvo', 'model' => 'FH16', 'year' => 2022, 'type' => 'truck', 'status' => VehicleStatus::ACTIVE],
            ['plate_number' => 'DEF-5678', 'vehicle_id' => 'TRK002', 'brand' => 'Scania', 'model' => 'R500', 'year' => 2023, 'type' => 'truck', 'status' => VehicleStatus::ACTIVE],
            ['plate_number' => 'GHI-9012', 'vehicle_id' => 'TRK003', 'brand' => 'Mercedes', 'model' => 'Actros', 'year' => 2021, 'type' => 'truck', 'status' => VehicleStatus::MAINTENANCE],
            ['plate_number' => 'JKL-3456', 'vehicle_id' => 'TRK004', 'brand' => 'MAN', 'model' => 'TGX', 'year' => 2023, 'type' => 'truck', 'status' => VehicleStatus::ACTIVE],
            ['plate_number' => 'MNO-7890', 'vehicle_id' => 'TRK005', 'brand' => 'DAF', 'model' => 'XF', 'year' => 2022, 'type' => 'truck', 'status' => VehicleStatus::INACTIVE],
        ];

        
        foreach ($vehicleData as $data) {
            $vehicles->push(Vehicle::create($data));
        }

        $drivers = collect();
        $driverData = [
            ['name' => 'John Smith', 'email' => 'budi@example.com', 'phone' => '+1-555-0101', 'license_number' => 'LIC-001', 'status' => DriverStatus::DRIVING],
            ['name' => 'Maria Garcia', 'email' => 'maria.garcia@example.com', 'phone' => '+1-555-0102', 'license_number' => 'LIC-002', 'status' => DriverStatus::DRIVING],
            ['name' => 'Ahmed Hassan', 'email' => 'ahmed.hassan@example.com', 'phone' => '+1-555-0103', 'license_number' => 'LIC-003', 'status' => DriverStatus::ON_BREAK],
            ['name' => 'Sarah Johnson', 'email' => 'sarah.johnson@example.com', 'phone' => '+1-555-0104', 'license_number' => 'LIC-004', 'status' => DriverStatus::AVAILABLE],
            ['name' => 'Carlos Mendez', 'email' => 'carlos.mendez@example.com', 'phone' => '+1-555-0105', 'license_number' => 'LIC-005', 'status' => DriverStatus::OFF_DUTY],
        ];

        foreach ($driverData as $data) {
            $drivers->push(Driver::create($data));
        }

        // assign vehicles to drivers (1-to-1 for demo)
        $vehicles[0]->update(['driver_id' => $drivers[0]->id]); // John -> TRK001
        $vehicles[1]->update(['driver_id' => $drivers[1]->id]); // Maria -> TRK002
        $vehicles[2]->update(['driver_id' => $drivers[2]->id]); // Ahmed -> TRK003
        $vehicles[3]->update(['driver_id' => $drivers[3]->id]); // Sarah -> TRK004
        $vehicles[4]->update(['driver_id' => $drivers[4]->id]); // Carlos -> TRK005

        $now = Carbon::now();

        $activeSession = DrivingSession::create([
            'vehicle_id' => $vehicles[1]->id,
            'driver_id' => $drivers[1]->id,
            'start_time' => $now->copy()->subHours(2),
            'start_latitude' => 40.7128,
            'start_longitude' => -74.0060,
            'current_latitude' => 40.7580,
            'current_longitude' => -73.9855,
            'driving_duration_seconds' => 7200,
            'max_speed' => 95.5,
            'average_speed' => 55.3,
            'total_distance_km' => 110.5,
            'is_active' => true,
        ]);

        
        $activeSession2 = DrivingSession::create([
            'vehicle_id' => $vehicles[0]->id,
            'driver_id' => $drivers[0]->id,
            'start_time' => $now->copy()->subHours(1),
            'start_latitude' => -6.5703,
            'start_longitude' => 107.8421,
            'current_latitude' => -6.5703,
            'current_longitude' => 107.8421,
            'driving_duration_seconds' => 3600,
            'max_speed' => 80.0,
            'average_speed' => 45.0,
            'total_distance_km' => 45.0,
            'is_active' => true,
        ]);

        $locations = [
            [40.7128, -74.0060, 45.0, 90.0, $now->copy()->subHours(2)],
            [40.7150, -74.0040, 50.0, 85.0, $now->copy()->subMinutes(115)],
            [40.7200, -74.0000, 55.0, 88.0, $now->copy()->subMinutes(110)],
            [40.7250, -73.9950, 60.0, 92.0, $now->copy()->subMinutes(105)],
            [40.7300, -73.9900, 58.0, 87.0, $now->copy()->subMinutes(100)],
            [40.7350, -73.9880, 62.0, 90.0, $now->copy()->subMinutes(95)],
            [40.7400, -73.9850, 70.0, 85.0, $now->copy()->subMinutes(90)],
            [40.7450, -73.9830, 75.0, 88.0, $now->copy()->subMinutes(85)],
            [40.7500, -73.9800, 80.0, 90.0, $now->copy()->subMinutes(80)],
            [40.7580, -73.9855, 65.0, 95.0, $now->copy()->subMinutes(75)],
        ];

        foreach ($locations as $loc) {
            LocationHistory::create([
                'vehicle_id' => $vehicles[1]->id,
                'driving_session_id' => $activeSession->id,
                'latitude' => $loc[0],
                'longitude' => $loc[1],
                'speed' => $loc[2],
                'heading' => $loc[3],
                'accuracy' => 5.0,
                'timestamp' => $loc[4],
            ]);
        }

        // Location history for ABC-1234 (John Smith - active session)
        LocationHistory::create([
            'vehicle_id' => $vehicles[0]->id,
            'driving_session_id' => $activeSession2->id,
            'latitude' => -6.5703,
            'longitude' => 107.8421,
            'speed' => 0.0,
            'heading' => 0.0,
            'accuracy' => 5.0,
            'timestamp' => $now->copy()->subMinutes(30),
        ]);

        Trip::create([
            'vehicle_id' => $vehicles[1]->id,
            'driver_id' => $drivers[1]->id,
            'start_time' => $now->copy()->subHours(2),
            'start_latitude' => 40.7128,
            'start_longitude' => -74.0060,
            'total_distance_km' => 110.5,
            'status' => 'IN_PROGRESS',
        ]);

        Trip::create([
            'vehicle_id' => $vehicles[0]->id,
            'driver_id' => $drivers[0]->id,
            'start_time' => $now->copy()->subHours(1),
            'start_latitude' => -6.5703,
            'start_longitude' => 107.8421,
            'total_distance_km' => 45.0,
            'status' => 'IN_PROGRESS',
        ]);

        Alert::create([
            'vehicle_id' => $vehicles[1]->id,
            'driver_id' => $drivers[1]->id,
            'driving_session_id' => $activeSession->id,
            'type' => \App\Enums\AlertType::SPEEDING,
            'severity' => \App\Enums\AlertSeverity::MEDIUM,
            'message' => 'Vehicle exceeding speed limit: 95.5 km/h',
            'latitude' => 40.7450,
            'longitude' => -73.9830,
            'speed' => 95.5,
            'is_read' => false,
        ]);

        Alert::create([
            'vehicle_id' => $vehicles[0]->id,
            'driver_id' => $drivers[0]->id,
            'driving_session_id' => $activeSession2->id,
            'type' => \App\Enums\AlertType::DRIVING_TIME,
            'severity' => \App\Enums\AlertSeverity::HIGH,
            'message' => 'Driver has been driving for 1h 0m.',
            'is_read' => false,
        ]);

        \App\Models\User::create([
            'name' => 'Admin',
            'email' => '',
            'password' => bcrypt('password'),
            'role' => 'admin',
        ]);

        foreach ($driverData as $data) {
            \App\Models\User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => bcrypt('password'),
                'role' => 'driver',
            ]);
        }
    }
}
