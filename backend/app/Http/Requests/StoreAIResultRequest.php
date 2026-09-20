<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreAIResultRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'vehicle_id' => 'required|integer|exists:vehicles,id',
            'seatbelt' => 'nullable|boolean',
            'fatigue' => 'nullable|boolean',
            'phone_usage' => 'nullable|boolean',
            'eye_closed' => 'nullable|numeric|min:0|max:1',
            'yawning' => 'nullable|boolean',
            'looking_away' => 'nullable|boolean',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'timestamp' => 'nullable|date',
        ];
    }
}
