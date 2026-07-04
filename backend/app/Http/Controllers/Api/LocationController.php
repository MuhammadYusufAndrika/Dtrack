<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreLocationRequest;
use App\Http\Resources\LocationResource;
use App\Services\LocationService;
use Illuminate\Http\JsonResponse;

class LocationController extends Controller
{
    public function __construct(
        private LocationService $locationService,
    ) {}

    public function store(StoreLocationRequest $request): JsonResponse
    {
        try {
            $location = $this->locationService->processLocationUpdate(
                $request->input('vehicle_id'),
                $request->validated()
            );

            return response()->json([
                'success' => true,
                'message' => 'Location updated successfully.',
                'data' => new LocationResource($location),
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'data' => null,
            ], 400);
        }
    }
}
