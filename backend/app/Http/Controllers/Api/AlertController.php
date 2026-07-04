<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\AlertResource;
use App\Services\AlertService;
use Illuminate\Http\JsonResponse;

class AlertController extends Controller
{
    public function __construct(
        private AlertService $alertService,
    ) {}

    public function index(): JsonResponse
    {
        $alerts = $this->alertService->getAllAlerts();

        return response()->json([
            'success' => true,
            'message' => 'Alerts retrieved successfully.',
            'data' => AlertResource::collection($alerts),
        ]);
    }

    public function show($id): JsonResponse
    {
        $alert = $this->alertService->getAlertById($id);

        if (!$alert) {
            return response()->json([
                'success' => false,
                'message' => 'Alert not found.',
                'data' => null,
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Alert retrieved successfully.',
            'data' => new AlertResource($alert),
        ]);
    }

    public function markAsRead($id): JsonResponse
    {
        try {
            $alert = $this->alertService->markAsRead($id);

            return response()->json([
                'success' => true,
                'message' => 'Alert marked as read.',
                'data' => new AlertResource($alert),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Alert not found.',
                'data' => null,
            ], 404);
        }
    }

    public function getActive(): JsonResponse
    {
        $alerts = $this->alertService->getActiveAlerts();

        return response()->json([
            'success' => true,
            'message' => 'Active alerts retrieved successfully.',
            'data' => AlertResource::collection($alerts),
        ]);
    }
}
