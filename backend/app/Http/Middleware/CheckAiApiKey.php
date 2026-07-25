<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckAiApiKey
{
    /**
     * Handle an incoming request.
     *
     * Allows requests that supply the correct X-API-Key header matching
     * the FLEETVISION_AI_API_KEY env variable. This is used by the AI
     * service to POST inference results without a user session token.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $expectedKey = config('fleetvision.ai_api_key');

        if (empty($expectedKey) || $request->header('X-API-Key') !== $expectedKey) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Valid X-API-Key header required.',
            ], 401);
        }

        return $next($request);
    }
}
