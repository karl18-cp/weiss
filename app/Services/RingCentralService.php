<?php

namespace App\Services;

use Carbon\CarbonInterface;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class RingCentralService
{
    public function callLog(CarbonInterface $from): array
    {
        $this->assertConfigured();
        $response = $this->api()
            ->withToken($this->accessToken())
            ->get('/restapi/v1.0/account/~/call-log', [
                'view' => 'Detailed',
                'dateFrom' => $from->utc()->toIso8601String(),
                'dateTo' => now()->utc()->toIso8601String(),
                'perPage' => 1000,
            ]);

        if ($response->failed()) {
            throw new RuntimeException($response->json('message') ?: 'RingCentral could not read the call log.');
        }

        return $response->json('records') ?? [];
    }

    /** @return array{body: string, content_type: string} */
    public function recording(string $recordingId): array
    {
        $this->assertConfigured();
        if (! preg_match('/\A[A-Za-z0-9_-]+\z/', $recordingId)) {
            throw new RuntimeException('The RingCentral recording ID is invalid.');
        }

        $response = $this->api()
            ->withToken($this->accessToken())
            ->get('/restapi/v1.0/account/~/recording/'.rawurlencode($recordingId).'/content');

        if ($response->failed()) {
            throw new RuntimeException($response->json('message') ?: 'RingCentral could not download the recording.');
        }

        return [
            'body' => $response->body(),
            'content_type' => $response->header('Content-Type') ?: 'audio/mpeg',
        ];
    }

    public function ringOut(string $phoneNumber): array
    {
        $this->assertConfigured();

        $response = $this->api()
            ->withToken($this->accessToken())
            ->post('/restapi/v1.0/account/~/extension/~/ring-out', [
                'from' => [
                    'phoneNumber' => $this->normalizePhoneNumber(
                        (string) config('services.ringcentral.from_number'),
                    ),
                ],
                'to' => [
                    'phoneNumber' => $this->normalizePhoneNumber($phoneNumber),
                ],
                'playPrompt' => true,
            ]);

        if ($response->failed()) {
            throw new RuntimeException(
                $response->json('message') ?: 'RingCentral could not start the call.',
            );
        }

        return $response->json();
    }

    public function ringOutStatus(string $callId): array
    {
        $this->assertConfigured();

        if (! preg_match('/\A[A-Za-z0-9_-]+\z/', $callId)) {
            throw new RuntimeException('The RingCentral call ID is invalid.');
        }

        $response = $this->api()
            ->withToken($this->accessToken())
            ->get('/restapi/v1.0/account/~/extension/~/ring-out/'.rawurlencode($callId));

        if ($response->failed()) {
            throw new RuntimeException(
                $response->json('message') ?: 'RingCentral could not read the call status.',
            );
        }

        return $response->json();
    }

    public function normalizePhoneNumber(string $phoneNumber): string
    {
        $trimmed = trim($phoneNumber);
        $hasPlus = str_starts_with($trimmed, '+');
        $digits = preg_replace('/\D+/', '', $trimmed) ?? '';

        if ($digits === '') {
            throw new RuntimeException('A valid phone number is required.');
        }

        if ($hasPlus) {
            return '+'.$digits;
        }

        if (strlen($digits) === 10) {
            return '+'.config('services.ringcentral.default_country_code', '1').$digits;
        }

        if (strlen($digits) === 11 && str_starts_with($digits, '1')) {
            return '+'.$digits;
        }

        return '+'.$digits;
    }

    private function accessToken(): string
    {
        $cacheKey = 'ringcentral.access_token.'.hash(
            'sha256',
            (string) config('services.ringcentral.client_id'),
        );

        if (is_string($token = Cache::get($cacheKey)) && $token !== '') {
            return $token;
        }

        $response = $this->api()
            ->asForm()
            ->withBasicAuth(
                (string) config('services.ringcentral.client_id'),
                (string) config('services.ringcentral.client_secret'),
            )
            ->post('/restapi/oauth/token', [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion' => config('services.ringcentral.jwt'),
            ]);

        if ($response->failed() || ! is_string($response->json('access_token'))) {
            throw new RuntimeException(
                $response->json('error_description') ?: 'RingCentral authentication failed.',
            );
        }

        $token = $response->json('access_token');
        $ttl = max(60, ((int) $response->json('expires_in', 3600)) - 60);

        Cache::put($cacheKey, $token, now()->addSeconds($ttl));

        return $token;
    }

    private function api(): PendingRequest
    {
        return Http::baseUrl(rtrim(
            (string) config('services.ringcentral.server_url'),
            '/',
        ))
            ->acceptJson()
            ->timeout(15)
            ->connectTimeout(5);
    }

    private function assertConfigured(): void
    {
        foreach (['client_id', 'client_secret', 'jwt', 'from_number'] as $key) {
            if (blank(config("services.ringcentral.{$key}"))) {
                throw new RuntimeException('RingCentral calling is not configured.');
            }
        }
    }
}
