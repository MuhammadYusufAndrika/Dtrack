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
            'start_latitude' => 'nullable|numeric|between:-90,90',
            'start_longitude' => 'nullable|numeric|between:-180,180',
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
        $trip = $this->tripService->getTripById($id);

        if (!$trip) {
            return response()->json([
                'success' => false,
                'message' => 'Trip not found.',
                'data' => null,
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Trip retrieved successfully.',
            'data' => $trip->load(['vehicle', 'driver']),
        ]);
    }

    public function update(Request $request, $id): JsonResponse
    {
        $action = $request->input('action', 'end');

        try {
            if ($action === 'start') {
                $trip = $this->tripService->startTrip($id);
                $message = 'Trip started successfully.';
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
