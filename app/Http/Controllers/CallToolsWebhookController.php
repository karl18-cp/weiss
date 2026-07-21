<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\Agent;
use App\Models\Company;
use App\Models\Lead;
use App\Models\LeadAgentAssignment;
use App\Models\LeadNote;
use App\Models\Product;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Schema;
use Throwable;

class CallToolsWebhookController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $secret = (string) config('services.calltools.webhook_secret');

        if ($secret === '') {
            return response()->json(['message' => 'CallTools webhook is not configured.'], 503);
        }

        $credentials = array_filter([
            'authorization_bearer' => $request->bearerToken(),
            'x_calltools_secret' => $request->header('X-CallTools-Secret'),
            'webhook_secret_body' => $request->input('webhook_secret'),
        ], fn (mixed $value): bool => is_scalar($value) && trim((string) $value) !== '');

        $authenticatedVia = null;

        foreach ($credentials as $source => $credential) {
            if (hash_equals($secret, trim((string) $credential))) {
                $authenticatedVia = $source;
                break;
            }
        }

        if ($authenticatedVia === null) {
            return response()->json([
                'message' => 'CallTools webhook authentication failed.',
                'error' => $credentials === []
                    ? 'webhook_credentials_missing'
                    : 'webhook_secret_mismatch',
                'received_credentials' => collect($credentials)
                    ->mapWithKeys(fn (mixed $value, string $source): array => [
                        $source => [
                            'length' => strlen(trim((string) $value)),
                            'fingerprint' => substr(hash('sha256', trim((string) $value)), 0, 12),
                        ],
                    ]),
                'expected_fingerprint' => substr(hash('sha256', $secret), 0, 12),
                'accepted_methods' => [
                    'Authorization: Bearer <secret>',
                    'X-CallTools-Secret: <secret>',
                    'webhook_secret body field',
                ],
                'hint' => $credentials === []
                    ? 'CallTools did not send any supported webhook credential.'
                    : 'None of the received credentials matches CALLTOOLS_WEBHOOK_SECRET in the server environment. If the environment value changed, run php artisan optimize:clear.',
            ], 401);
        }

        $phoneNumber = $this->firstFilled($request, [
            'phone_number',
            'mobile_primary',
            'active_number',
            'primary_phone_number',
            'phone',
        ]);
        $contactId = $this->firstFilled($request, ['contact_id', 'id']);
        $telemarketerNotes = $this->firstFilled($request, [
            'notes',
            'last_note_text',
            'note',
            'telemarketer_notes',
        ]);
        $appointmentValue = $this->firstFilled($request, [
            'appointment_at',
            'appoint_time',
            'appointment_time',
            'appointment_date',
            'appointment_datetime',
        ]);
        $appointmentAt = $this->normalizeAppointment($appointmentValue);

        if ($contactId === null && $phoneNumber !== null) {
            $contactId = 'phone-'.hash('sha256', preg_replace('/\D+/', '', $phoneNumber) ?: $phoneNumber);
        }

        $request->merge([
            'contact_id' => $contactId,
            'phone_number' => $phoneNumber,
            'notes' => $telemarketerNotes,
            'appointment_at' => $appointmentAt ?? $appointmentValue,
        ]);

        $validator = Validator::make($request->all(), [
            'event' => ['nullable', 'string', 'max:100'],
            'contact_id' => ['required', 'string', 'max:100'],
            'first_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['nullable', 'string', 'max:100'],
            'phone_number' => ['required', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'county' => ['nullable', 'string', 'max:100'],
            'state' => ['nullable', 'string', 'max:50'],
            'zip_code' => ['nullable', 'string', 'max:15'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'agent_name' => ['nullable', 'string', 'max:255'],
            'campaign_name' => ['nullable', 'string', 'max:255'],
            'product' => ['nullable', 'string', 'max:255'],
            'appointment_at' => [
                'nullable',
                'string',
                'max:100',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if ($this->normalizeAppointment(is_scalar($value) ? (string) $value : null) === null) {
                        $fail('The appointment date and time format is not recognized.');
                    }
                },
            ],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'The CallTools payload is invalid.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $data = $validator->validated();
        $data['appointment_at'] = $this->normalizeAppointment($data['appointment_at'] ?? null);
        $relationships = $this->resolveRelationships(
            $data['agent_name'] ?? null,
            $data['product'] ?? null,
        );

        if ($relationships instanceof JsonResponse) {
            return $relationships;
        }

        $name = trim(implode(' ', array_filter([
            $data['first_name'] ?? null,
            $data['last_name'] ?? null,
        ])));
        $telemarketerNotes = trim((string) ($data['notes'] ?? ''));
        $existingLead = Lead::query()
            ->where('calltools_contact_id', $data['contact_id'])
            ->first();

        $lead = Lead::query()->updateOrCreate(
            ['calltools_contact_id' => $data['contact_id']],
            [
                'customer_name' => $name !== '' ? $name : 'CallTools Contact '.$data['contact_id'],
                'marital_status' => 'Unknown',
                'primary_number' => $data['phone_number'],
                'address' => $data['address'] ?? 'Not provided',
                'zip_code' => $data['zip_code'] ?? 'N/A',
                'city' => $data['city'] ?? 'Unknown',
                'county' => $data['county'] ?? 'Unknown',
                'state' => $data['state'] ?? 'Unknown',
                'email' => $data['email'] ?? null,
                'years_in_house' => 0,
                'product_id' => $relationships['product_id'],
                'appointment_at' => $data['appointment_at'] ?? now(),
                'telemarketer_notes' => $telemarketerNotes !== ''
                    ? $telemarketerNotes
                    : ($existingLead?->telemarketer_notes ?: 'Imported from CallTools.'),
                'company_id' => $relationships['company_id'],
                'source' => 'CallTools',
                'calltools_campaign_name' => $data['campaign_name'] ?? null,
                'agent_id' => $existingLead?->agent_id ?? $relationships['agent_id'],
                'created_by' => $relationships['created_by'],
                'status' => 'fresh',
            ],
        );

        if ($existingLead && (int) $relationships['agent_id'] !== (int) $lead->agent_id) {
            $hasAssignmentHistory = class_exists(LeadAgentAssignment::class)
                && Schema::hasTable('lead_agent_assignments');
            $latestAgentId = $hasAssignmentHistory
                ? (int) (LeadAgentAssignment::query()
                    ->where('lead_id', $lead->id)
                    ->latest('id')
                    ->value('agent_id') ?? $lead->agent_id)
                : (int) ($lead->agent_2_id ?: $lead->agent_id);

            if ($latestAgentId !== (int) $relationships['agent_id']) {
                if ($hasAssignmentHistory) {
                    LeadAgentAssignment::query()->create([
                        'lead_id' => $lead->id,
                        'agent_id' => $relationships['agent_id'],
                        'assigned_by' => $relationships['created_by'],
                        'is_original' => false,
                    ]);
                }

                if (! $lead->agent_2_id) {
                    $lead->update(['agent_2_id' => $relationships['agent_id']]);
                }

                $agentName = Agent::query()
                    ->whereKey($relationships['agent_id'])
                    ->value('agent_name') ?? 'Unknown agent';
                LeadNote::query()->create([
                    'lead_id' => $lead->id,
                    'note_type' => 'agent_reassigned',
                    'body' => "Agent reassigned to {$agentName} by CallTools.",
                    'created_by' => $relationships['created_by'],
                ]);
            }
        }

        if ($telemarketerNotes !== '') {
            $latestNote = $lead->notes()
                ->where('note_type', 'telemarketer')
                ->latest('id')
                ->value('body');

            if ($latestNote !== $telemarketerNotes) {
                LeadNote::query()->create([
                    'lead_id' => $lead->id,
                    'note_type' => 'telemarketer',
                    'body' => $telemarketerNotes,
                    'created_by' => $relationships['created_by'],
                ]);
            }
        }

        return response()->json([
            'message' => $lead->wasRecentlyCreated ? 'Lead created.' : 'Lead updated.',
            'lead_id' => $lead->getKey(),
            'calltools_contact_id' => $lead->calltools_contact_id,
        ], $lead->wasRecentlyCreated ? 201 : 200);
    }

    /** @return array{company_id: int, product_id: int, agent_id: int, created_by: int}|JsonResponse */
    private function resolveRelationships(?string $agentName, ?string $productName): array|JsonResponse
    {
        $companyId = (int) config('services.calltools.default_company_id');
        $productId = (int) config('services.calltools.default_product_id');
        $agentId = (int) config('services.calltools.default_agent_id');
        $createdBy = (int) config('services.calltools.created_by');

        if (is_string($agentName) && trim($agentName) !== '') {
            $matchedAgent = Agent::query()
                ->where('agent_name', trim($agentName))
                ->value('agent_id');

            $agentId = $matchedAgent ? (int) $matchedAgent : $agentId;
        }

        if (is_string($productName) && trim($productName) !== '') {
            $input = $this->normalizeProductName($productName);
            $products = Product::query()->get(['prod_id', 'product_name']);
            $matchedProduct = $products->first(
                fn (Product $product): bool => $this->normalizeProductName($product->product_name) === $input,
            );

            if (! $matchedProduct) {
                $partialMatches = $products->filter(function (Product $product) use ($input): bool {
                    $normalized = $this->normalizeProductName($product->product_name);

                    return str_contains(' '.$normalized.' ', ' '.$input.' ');
                });

                $matchedProduct = $partialMatches->count() === 1
                    ? $partialMatches->first()
                    : null;
            }

            $productId = $matchedProduct ? (int) $matchedProduct->prod_id : $productId;
        }

        $missing = [];

        if (! Company::query()->whereKey($companyId)->exists()) {
            $missing[] = 'CALLTOOLS_DEFAULT_COMPANY_ID';
        }
        if (! Product::query()->whereKey($productId)->exists()) {
            $missing[] = 'CALLTOOLS_DEFAULT_PRODUCT_ID';
        }
        if (! Agent::query()->whereKey($agentId)->exists()) {
            $missing[] = 'CALLTOOLS_DEFAULT_AGENT_ID';
        }
        if (! Account::query()->whereKey($createdBy)->exists()) {
            $missing[] = 'CALLTOOLS_CREATED_BY_ACCOUNT_ID';
        }

        if ($missing !== []) {
            return response()->json([
                'message' => 'CallTools lead defaults are not configured.',
                'missing' => $missing,
            ], 503);
        }

        return [
            'company_id' => $companyId,
            'product_id' => $productId,
            'agent_id' => $agentId,
            'created_by' => $createdBy,
        ];
    }

    private function normalizeProductName(string $value): string
    {
        return trim((string) preg_replace(
            '/\s+/',
            ' ',
            preg_replace('/[^a-z0-9]+/i', ' ', mb_strtolower($value)),
        ));
    }

    private function normalizeAppointment(?string $value): ?string
    {
        if ($value === null || trim($value) === '') {
            return null;
        }

        $value = trim($value);

        if (preg_match('/^\d{10,13}$/', $value) === 1) {
            $timestamp = (int) $value;

            if (strlen($value) === 13) {
                $timestamp = (int) floor($timestamp / 1000);
            }

            return CarbonImmutable::createFromTimestamp($timestamp)
                ->format('Y-m-d H:i:s');
        }

        $candidates = array_unique([
            $value,
            preg_replace('/\s+at\s+/i', ' ', $value) ?? $value,
            preg_replace('/(\d)(st|nd|rd|th)\b/i', '$1', $value) ?? $value,
        ]);

        foreach ($candidates as $candidate) {
            try {
                return CarbonImmutable::parse($candidate)->format('Y-m-d H:i:s');
            } catch (Throwable) {
                // Try extracting the first date/time from a displayed range.
            }
        }

        if (preg_match(
            '/(?:[A-Za-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?[,]?\s+\d{4}|\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4})[,]?\s+(?:at\s+)?\d{1,2}:\d{2}(?:\s*[AP]M)?/i',
            $value,
            $match,
        ) === 1) {
            try {
                $candidate = preg_replace('/\s+at\s+/i', ' ', $match[0]) ?? $match[0];
                $candidate = preg_replace('/(\d)(st|nd|rd|th)\b/i', '$1', $candidate) ?? $candidate;

                return CarbonImmutable::parse($candidate)->format('Y-m-d H:i:s');
            } catch (Throwable) {
                return null;
            }
        }

        return null;
    }

    /** @param list<string> $keys */
    private function firstFilled(Request $request, array $keys): ?string
    {
        foreach ($keys as $key) {
            $value = $request->input($key);

            if (is_scalar($value) && trim((string) $value) !== '') {
                return trim((string) $value);
            }
        }

        return null;
    }
}
