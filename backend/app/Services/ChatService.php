<?php

namespace App\Services;

use App\Events\ChatMessageSent;
use App\Events\ChatMessageDeleted;
use App\Models\ChatMessage;
use App\Models\Driver;
use App\Models\User;
use App\Repositories\ChatRepository;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class ChatService
{
    public function __construct(
        private ChatRepository $chatRepository,
    ) {}

    public function resolveDriverForUser(User $user): ?Driver
    {
        if (($user->role ?? null) === 'admin') {
            return null;
        }
        return Driver::where('email', $user->email)->first();
    }

    public function isAdmin(User $user): bool
    {
        return ($user->role ?? null) === 'admin';
    }

    /** Isi satu thread (milik sopir login, atau driver_id bila admin). */
    public function getThread(User $user, ?int $driverId = null): Collection
    {
        $driverId = $this->targetDriverId($user, $driverId);
        return $this->chatRepository->query()
            ->where('driver_id', $driverId)
            ->orderBy('created_at')
            ->limit(200)
            ->get();
    }

    /** Daftar thread untuk admin: driver + pesan terakhir + unread dari sopir. */
    public function getThreads(): \Illuminate\Support\Collection
    {
        $latestIds = ChatMessage::selectRaw('MAX(id) as id')
            ->groupBy('driver_id')
            ->pluck('id');

        $threads = $this->chatRepository->query()
            ->whereIn('chat_messages.id', $latestIds)
            ->with('driver')
            ->orderByDesc('created_at')
            ->get();

        $unread = ChatMessage::selectRaw('driver_id, COUNT(*) as cnt')
            ->where('sender_role', 'driver')
            ->where('is_read', false)
            ->groupBy('driver_id')
            ->pluck('cnt', 'driver_id');

        return $threads->map(function (ChatMessage $m) use ($unread) {
            return [
                'driver' => $m->driver,
                'last_message' => $m,
                'unread' => (int) ($unread[$m->driver_id] ?? 0),
            ];
        })->values();
    }

    public function send(User $user, ?int $driverId, string $body): ChatMessage
    {
        return DB::transaction(function () use ($user, $driverId, $body) {
            $isAdmin = $this->isAdmin($user);
            if ($isAdmin && !$driverId) {
                throw new \InvalidArgumentException('driver_id wajib diisi admin.');
            }
            $targetId = $this->targetDriverId($user, $driverId);

            $message = $this->chatRepository->create([
                'driver_id' => $targetId,
                'sender_role' => $isAdmin ? 'admin' : 'driver',
                'sender_id' => $user->id,
                'body' => $body,
                'is_read' => false,
            ]);

            // Broadcast jangan sampai menggagalkan simpan pesan:
            // bila Reverb mati, chat tetap tersimpan & polling yang ambil alih.
            try {
                broadcast(new ChatMessageSent(
                    driver_id: $targetId,
                    message: $message->fresh()->toArray(),
                ))->toOthers();
            } catch (\Exception $e) {
                \Illuminate\Support\Facades\Log::warning('Chat broadcast gagal: '.$e->getMessage());
            }

            return $message;
        });
    }

    /** Tandai pesan lawan bicara sebagai dibaca dalam satu thread. */
    public function markRead(User $user, ?int $driverId = null): int
    {
        $targetId = $this->targetDriverId($user, $driverId);
        $fromRole = $this->isAdmin($user) ? 'driver' : 'admin';
        return $this->chatRepository->query()
            ->where('driver_id', $targetId)
            ->where('sender_role', $fromRole)
            ->where('is_read', false)
            ->update(['is_read' => true]);
    }

    public function unreadForDriver(int $driverId): int
    {
        return $this->chatRepository->query()
            ->where('driver_id', $driverId)
            ->where('sender_role', 'admin')
            ->where('is_read', false)
            ->count();
    }

    /** Hapus satu pesan. Sopir: hanya pesan sendiri; admin: pesan mana pun. */
    public function deleteMessage(User $user, int $id): ChatMessage
    {
        return DB::transaction(function () use ($user, $id) {
            $message = $this->chatRepository->findOrFail($id);

            if (!$this->isAdmin($user)) {
                $driver = $this->resolveDriverForUser($user);
                if (!$driver
                    || (int) $message->driver_id !== (int) $driver->id
                    || $message->sender_role !== 'driver'
                    || (int) $message->sender_id !== (int) $user->id) {
                    throw new \RuntimeException('Tidak boleh menghapus pesan ini.');
                }
            }

            $driverId = (int) $message->driver_id;
            $message->delete();

            try {
                broadcast(new ChatMessageDeleted(
                    driver_id: $driverId,
                    message_id: $id,
                ))->toOthers();
            } catch (\Exception $e) {
                \Illuminate\Support\Facades\Log::warning('Chat delete broadcast gagal: '.$e->getMessage());
            }

            return $message;
        });
    }

    /** Hapus seluruh riwayat satu thread. Sopir: thread sendiri; admin: wajib driver_id. */
    public function clearThread(User $user, ?int $driverId = null): int
    {
        return DB::transaction(function () use ($user, $driverId) {
            $targetId = $this->targetDriverId($user, $driverId);
            $count = $this->chatRepository->query()
                ->where('driver_id', $targetId)
                ->delete();

            try {
                broadcast(new ChatMessageDeleted(
                    driver_id: $targetId,
                    cleared_thread: true,
                ))->toOthers();
            } catch (\Exception $e) {
                \Illuminate\Support\Facades\Log::warning('Chat clear broadcast gagal: '.$e->getMessage());
            }

            return $count;
        });
    }

    private function targetDriverId(User $user, ?int $driverId): int
    {
        if ($this->isAdmin($user)) {
            if (!$driverId) {
                throw new \InvalidArgumentException('driver_id wajib diisi admin.');
            }
            return $driverId;
        }
        $driver = $this->resolveDriverForUser($user);
        if (!$driver) {
            throw new \RuntimeException('Akun ini belum ditautkan ke profil driver.');
        }
        return $driver->id;
    }
}
