<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\VehicleResource;
use App\Services\VehicleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VehicleController extends Controller
{
    public function __construct(
        private VehicleService $vehicleService,
    ) {}

    public function index(): JsonResponse
    {
        $vehicles = $this->vehicleService->getAllVehicles();

        return response()->json([
            'success' => true,
            'message' => 'Vehicles retrieved successfully.',
            'data' => VehicleResource::collection($vehicles),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'plate_number' => 'required|string|max:20|unique:vehicles,plate_number',
            'vehicle_id' => 'required|string|max:20|unique:vehicles,vehicle_id',
            'brand' => 'required|string|max:50',
            'model' => 'required|string|max:50',
            'year' => 'required|integer|min:1900|max:2100',
            'type' => 'required|string|max:50',
            'status' => 'nullable|string|in:active,inactive,maintenance,out_of_service',
        ]);

        $vehicle = $this->vehicleService->registerVehicle($validated);

        return response()->json([
            'success' => true,
            'message' => 'Vehicle registered successfully.',
            'data' => new VehicleResource($vehicle),
        ], 201);
    }

    public function show($id): JsonResponse
    {
        $vehicle = $this->vehicleService->getVehicleById($id);

        if (!$vehicle) {
            return response()->json([
                'success' => false,
                'message' => 'Vehicle not found.',
                'data' => null,
            ], 404);
        }

        $vehicle->load('latestLocation');

        return response()->json([
            'success' => true,
            'message' => 'Vehicle retrieved successfully.',
            'data' => new VehicleResource($vehicle),
        ]);
    }

    public function update(Request $request, $id): JsonResponse
    {
        $validated = $request->validate([
            'plate_number' => 'sometimes|string|max:20|unique:vehicles,plate_number,' . $id,
            'vehicle_id' => 'sometimes|string|max:20|unique:vehicles,vehicle_id,' . $id,
            'brand' => 'sometimes|string|max:50',
            'model' => 'sometimes|string|max:50',
            'year' => 'sometimes|integer|min:1900|max:2100',
            'type' => 'sometimes|string|max:50',
            'status' => 'sometimes|string|in:active,inactive,maintenance,out_of_service',
        ]);

        try {
            $vehicle = $this->vehicleService->updateVehicle($id, $validated);

            return response()->json([
                'success' => true,
                'message' => 'Vehicle updated successfully.',
                'data' => new VehicleResource($vehicle),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Vehicle not found.',
                'data' => null,
            ], 404);
        }
    }

    public function destroy($id): JsonResponse
    {
        try {
            $this->vehicleService->deleteVehicle($id);

            return response()->json([
                'success' => true,
                'message' => 'Vehicle deleted successfully.',
                'data' => null,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Vehicle not found.',
                'data' => null,
            ], 404);
        }
    }

    public function getLocations($id): JsonResponse
    {
        $vehicle = $this->vehicleService->getVehicleLocations($id);

        if (!$vehicle) {
            return response()->json([
                'success' => false,
                'message' => 'Vehicle not found.',
                'data' => null,
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Vehicle locations retrieved successfully.',
            'data' => new VehicleResource($vehicle),
        ]);
    }
}
