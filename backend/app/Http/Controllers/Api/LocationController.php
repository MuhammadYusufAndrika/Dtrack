<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreLocationRequest;
use App\Http\Resources\LocationResource;
use App\Services\LocationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

    /**
     * Batch kirim antrean GPS offline (dipakai aplikasi Android).
     * Body: array JSON langsung, maks 200 titik.
     */
    public function batch(Request $request): JsonResponse
    {
        $items = $request->validate([
            '*.vehicle_id' => 'required|integer|exists:vehicles,id',
            '*.latitude' => 'required|numeric|between:-90,90',
            '*.longitude' => 'required|numeric|between:-180,180',
            '*.speed' => 'nullable|numeric|min:0',
            '*.heading' => 'nullable|numeric|between:0,360',
            '*.accuracy' => 'nullable|numeric|min:0',
            '*.timestamp' => 'nullable|date',
        ]);

        $items = array_values($items);
        if (count($items) > 200) {
            return response()->json([
                'success' => false,
                'message' => 'Maksimal 200 titik per batch.',
                'data' => null,
            ], 422);
        }

        $saved = 0;
        foreach ($items as $item) {
            try {
                $this->locationService->processLocationUpdate($item['vehicle_id'], $item);
                $saved++;
            } catch (\Exception $e) {
                continue; // titik rusak dilewati, sisa antrean tetap diproses
            }
        }

        return response()->json([
            'success' => $saved > 0,
            'message' => "Saved {$saved} of " . count($items) . ' locations.',
            'data' => ['saved' => $saved, 'total' => count($items)],
        ], $saved > 0 ? 201 : 400);
    }
}
