<?php

namespace App\Services;

use App\Models\Lead;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

class LeadGeocodingService
{
    public function geocode(Lead $lead): bool
    {
        $key = config('services.maptiler.api_key');
        if (! is_string($key) || $key === '') {
            return false;
        }

        $address = collect([
            $lead->address,
            $lead->city,
            $lead->state,
            $lead->zip_code,
        ])->filter()->implode(', ');

        if ($address === '') {
            $this->markFailed($lead);

            return false;
        }

        $response = $this->client()->get(
            'https://api.maptiler.com/geocoding/'.rawurlencode($address).'.json',
            [
                'key' => $key,
                'limit' => 1,
                'country' => 'us',
            ],
        );

        $coordinates = $response->successful()
            ? $response->json('features.0.geometry.coordinates')
            : null;

        if (! is_array($coordinates) || count($coordinates) < 2) {
            $this->markFailed($lead);

            return false;
        }

        $lead->forceFill([
            'longitude' => $coordinates[0],
            'latitude' => $coordinates[1],
            'geocoding_status' => 'geocoded',
            'geocoded_at' => now(),
        ])->saveQuietly();

        return true;
    }

    private function client(): PendingRequest
    {
        return Http::acceptJson()
            ->timeout(12)
            ->retry(2, 300, throw: false);
    }

    private function markFailed(Lead $lead): void
    {
        $lead->forceFill([
            'geocoding_status' => 'failed',
            'geocoded_at' => now(),
        ])->saveQuietly();
    }
}
