<?php

namespace App\Repositories;

use App\Models\ChatMessage;

class ChatRepository extends BaseRepository
{
    protected function modelClass(): string
    {
        return ChatMessage::class;
    }
}
