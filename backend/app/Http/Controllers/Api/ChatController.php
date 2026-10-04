<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ChatService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChatController extends Controller
{
    public function __construct(
        private ChatService $chatService,
    ) {}

    /** Isi thread: sopir -> miliknya; admin -> ?driver_id=. */
    public function index(Request $request): JsonResponse
    {
        try {
            $messages = $this->chatService->getThread(
                $request->user(),
                $request->integer('driver_id') ?: null
            );
            return response()->json([
                'success' => true,
                'message' => 'Chat retrieved successfully.',
                'data' => $messages,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'data' => null,
            ], 400);
        }
    }

    /** Daftar thread (admin saja). */
    public function threads(Request $request): JsonResponse
    {
        if (!$this->chatService->isAdmin($request->user())) {
            return response()->json([
                'success' => false,
                'message' => 'Forbidden.',
                'data' => null,
            ], 403);
        }
        return response()->json([
            'success' => true,
            'message' => 'Threads retrieved successfully.',
            'data' => $this->chatService->getThreads(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'driver_id' => 'nullable|integer|exists:drivers,id',
            'body' => 'required|string|max:2000',
        ]);

        try {
            $message = $this->chatService->send(
                $request->user(),
                $validated['driver_id'] ?? null,
                $validated['body']
            );
            return response()->json([
                'success' => true,
                'message' => 'Message sent successfully.',
                'data' => $message,
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'data' => null,
            ], 400);
        }
    }

    /** Tandai sudah dibaca ( Sopir: pesan admin; Admin: pesan sopir + driver_id ). */
    public function markRead(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'driver_id' => 'nullable|integer|exists:drivers,id',
        ]);

        try {
            $count = $this->chatService->markRead(
                $request->user(),
                $validated['driver_id'] ?? null
            );
            return response()->json([
                'success' => true,
                'message' => 'Marked as read.',
                'data' => ['updated' => $count],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'data' => null,
            ], 400);
        }
    }
}
