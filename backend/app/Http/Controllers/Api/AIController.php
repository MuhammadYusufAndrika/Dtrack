<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreAIResultRequest;
use App\Services\AIService;
use Illuminate\Http\JsonResponse;

class AIController extends Controller
{
    public function __construct(
        private AIService $aiService,
    ) {}

    public function store(StoreAIResultRequest $request): JsonResponse
    {
        try {
            $driverStatus = $this->aiService->processAIResult(
                $request->input('vehicle_id'),
                $request->validated()
            );

            return response()->json([
                'success' => true,
                'message' => 'AI result processed successfully.',
                'data' => $driverStatus,
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
