<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\DriverResource;
use App\Services\DriverService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DriverController extends Controller
{
    public function __construct(
        private DriverService $driverService,
    ) {}

    public function index(): JsonResponse
    {
        $drivers = $this->driverService->getAllDrivers();

        return response()->json([
            'success' => true,
            'message' => 'Drivers retrieved successfully.',
            'data' => DriverResource::collection($drivers),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:drivers,email',
            'phone' => 'required|string|max:20',
            'license_number' => 'required|string|max:50|unique:drivers,license_number',
            'photo_url' => 'nullable|string|max:500',
        ]);

        $driver = $this->driverService->registerDriver($validated);

        return response()->json([
            'success' => true,
            'message' => 'Driver registered successfully.',
            'data' => new DriverResource($driver),
        ], 201);
    }

    public function show($id): JsonResponse
    {
        $driver = $this->driverService->getDriverById($id);

        if (!$driver) {
            return response()->json([
                'success' => false,
                'message' => 'Driver not found.',
                'data' => null,
            ], 404);
        }

        // Eager-load vehicle and latest AI status so the admin detail page
        // can display camera feed (keyed by vehicle.vehicle_id) and AI results.
        $driver->load(['vehicle', 'latestStatus']);

        return response()->json([
            'success' => true,
            'message' => 'Driver retrieved successfully.',
            'data' => new DriverResource($driver),
        ]);
    }

    public function update(Request $request, $id): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:drivers,email,' . $id,
            'phone' => 'sometimes|string|max:20',
            'license_number' => 'sometimes|string|max:50|unique:drivers,license_number,' . $id,
            'status' => 'sometimes|string|in:available,driving,off_duty,on_break',
            'photo_url' => 'nullable|string|max:500',
        ]);

        try {
            $driver = $this->driverService->updateDriver($id, $validated);

            return response()->json([
                'success' => true,
                'message' => 'Driver updated successfully.',
                'data' => new DriverResource($driver),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Driver not found.',
                'data' => null,
            ], 404);
        }
    }

    public function destroy($id): JsonResponse
    {
        try {
            $this->driverService->deleteDriver($id);

            return response()->json([
                'success' => true,
                'message' => 'Driver deleted successfully.',
                'data' => null,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Driver not found.',
                'data' => null,
            ], 404);
        }
    }

    public function getStatus($id): JsonResponse
    {
        $driver = $this->driverService->getDriverHistory($id);

        if (!$driver) {
            return response()->json([
                'success' => false,
                'message' => 'Driver not found.',
                'data' => null,
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Driver status retrieved successfully.',
            'data' => new DriverResource($driver),
        ]);
    }

    /**
     * Assign or unassign a vehicle to/from this driver.
     *
     * PATCH /api/drivers/{driver}/assign-vehicle
     * Body: { "vehicle_id": 3 }   — assign vehicle with DB id 3
     *       { "vehicle_id": null } — unassign current vehicle
     */
    public function assignVehicle(\Illuminate\Http\Request $request, $id): JsonResponse
    {
        $validated = $request->validate([
            'vehicle_id' => 'nullable|integer|exists:vehicles,id',
        ]);

        $driver = $this->driverService->getDriverById($id);

        if (!$driver) {
            return response()->json([
                'success' => false,
                'message' => 'Driver not found.',
                'data' => null,
            ], 404);
        }

        $vehicleId = $validated['vehicle_id'] ?? null;

        if ($vehicleId !== null) {
            // Make sure the target vehicle is not already owned by another driver
            $conflict = \App\Models\Vehicle::where('id', $vehicleId)
                ->whereNotNull('driver_id')
                ->where('driver_id', '!=', $driver->id)
                ->first();

            if ($conflict) {
                return response()->json([
                    'success' => false,
                    'message' => 'Vehicle is already assigned to another driver.',
                    'data' => null,
                ], 422);
            }
        }

        // Detach old vehicle (clear its driver_id)
        \App\Models\Vehicle::where('driver_id', $driver->id)->update(['driver_id' => null]);

        // Attach new vehicle
        if ($vehicleId !== null) {
            \App\Models\Vehicle::where('id', $vehicleId)->update(['driver_id' => $driver->id]);
        }

        $driver->load('vehicle');

        return response()->json([
            'success' => true,
            'message' => $vehicleId ? 'Vehicle assigned successfully.' : 'Vehicle unassigned successfully.',
            'data' => new DriverResource($driver),
        ]);
    }
}
