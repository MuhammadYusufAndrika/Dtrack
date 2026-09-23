<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\TripService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TripController extends Controller
{
    public function __construct(
        private TripService $tripService,
    ) {}

    public function index(): JsonResponse
    {
        $trips = $this->tripService->getAllTrips();

        return response()->json([
            'success' => true,
            'message' => 'Trips retrieved successfully.',
            'data' => $trips,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'vehicle_id' => 'required|exists:vehicles,id',
            'driver_id' => 'required|exists:drivers,id',
            'origin' => 'nullable|string|max:255',
            'destination' => 'nullable|string|max:255',
            'start_latitude' => 'nullable|numeric|between:-90,90',
            'start_longitude' => 'nullable|numeric|between:-180,180',
            'dest_latitude' => 'nullable|numeric|between:-90,90',
            'dest_longitude' => 'nullable|numeric|between:-180,180',
            'planned_distance_km' => 'nullable|numeric|min:0',
        ]);

        $trip = $this->tripService->createTrip($validated);

        return response()->json([
            'success' => true,
            'message' => 'Trip created successfully.',
            'data' => $trip,
        ], 201);
    }

    public function show($id): JsonResponse
    {
        try {
            $detail = $this->tripService->getTripDetail($id);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Trip not found.',
                'data' => null,
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Trip retrieved successfully.',
            'data' => $detail,
        ]);
    }

    public function update(Request $request, $id): JsonResponse
    {
        $action = $request->input('action', 'end');

        try {
            if ($action === 'start') {
                $startCoords = $request->validate([
                    'start_latitude' => 'nullable|numeric|between:-90,90',
                    'start_longitude' => 'nullable|numeric|between:-180,180',
                ]);
                $trip = $this->tripService->startTrip($id, $startCoords);
                $message = 'Trip started successfully.';
            } elseif ($action === 'route') {
                $route = $request->validate([
                    'origin' => 'nullable|string|max:255',
                    'destination' => 'nullable|string|max:255',
                    'start_latitude' => 'nullable|numeric|between:-90,90',
                    'start_longitude' => 'nullable|numeric|between:-180,180',
                    'dest_latitude' => 'nullable|numeric|between:-90,90',
                    'dest_longitude' => 'nullable|numeric|between:-180,180',
                    'planned_distance_km' => 'nullable|numeric|min:0',
                ]);
                $trip = $this->tripService->updateRoute($id, $route);
                $message = 'Trip route updated successfully.';
            } else {
                $validated = $request->validate([
                    'end_latitude' => 'nullable|numeric|between:-90,90',
                    'end_longitude' => 'nullable|numeric|between:-180,180',
                    'total_distance_km' => 'nullable|numeric|min:0',
                ]);
                $trip = $this->tripService->endTrip($id, $validated);
                $message = 'Trip ended successfully.';
            }

            return response()->json([
                'success' => true,
                'message' => $message,
                'data' => $trip->load(['vehicle', 'driver']),
            ]);
        } catch (\RuntimeException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'data' => null,
            ], 400);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Trip not found.',
                'data' => null,
            ], 404);
        }
    }
}
