<?php

namespace App\Models;

use App\Services\WebPushService;
use App\Support\PhoneNumberVisibility;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\Schema;

#[Fillable([
    'customer_name', 'marital_status', 'primary_number', 'secondary_number',
    'mobile_number', 'address', 'zip_code', 'city', 'county', 'state', 'email',
    'latitude', 'longitude', 'geocoding_status', 'geocoded_at',
    'years_in_house', 'house_age', 'needs_financing', 'house_value',
    'crm_qualification_completed_at', 'product_id', 'appointment_at', 'appointment_duration_minutes',
    'appointment_result', 'telemarketer_notes',
    'company_id', 'source', 'agent_id', 'agent_2_id', 'manager_2_id', 'rep', 'salesman_1_id', 'salesman_2_id',
    'created_by', 'status', 'confirmation_notes',
    'calltools_contact_id', 'calltools_campaign_name',
])]
class Lead extends Model
{
    public const LEADS_SHOP_STATUSES = ['fresh', 'raw', 'cb', 'naov', 'verify'];

    public function toArray(): array
    {
        $data = parent::toArray();

        if (! PhoneNumberVisibility::canView()) {
            foreach (['primary_number', 'secondary_number', 'mobile_number'] as $field) {
                $data[$field] = PhoneNumberVisibility::mask($data[$field] ?? null);
            }
        }

        return $data;
    }

    public function scopeInLeadsShop(Builder $query): Builder
    {
        return $query->whereIn('status', self::LEADS_SHOP_STATUSES);
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id', 'com_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id', 'prod_id');
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(Agent::class, 'agent_id', 'agent_id');
    }

    public function secondAgent(): BelongsTo
    {
        return $this->belongsTo(Agent::class, 'agent_2_id', 'agent_id');
    }

    public function secondManager(): BelongsTo
    {
        return $this->belongsTo(Manager::class, 'manager_2_id', 'manager_id');
    }

    public function salesmanOne(): BelongsTo
    {
        return $this->belongsTo(Salesman::class, 'salesman_1_id', 'salesman_id');
    }

    public function salesmanTwo(): BelongsTo
    {
        return $this->belongsTo(Salesman::class, 'salesman_2_id', 'salesman_id');
    }

    public function notes(): HasMany
    {
        return $this->hasMany(LeadNote::class)->latest();
    }

    public function movements(): HasMany
    {
        return $this->hasMany(LeadMovement::class)->latest();
    }

    public function ringCentralCalls(): HasMany
    {
        return $this->hasMany(RingCentralCall::class)->latest('initiated_at');
    }

    public function agentAssignments(): HasMany
    {
        return $this->hasMany(LeadAgentAssignment::class)->oldest();
    }

    public function latestTelemarketerNote(): HasOne
    {
        return $this->hasOne(LeadNote::class)
            ->where('note_type', 'telemarketer')
            ->latestOfMany();
    }

    public function appointmentResultNotes(): HasMany
    {
        return $this->hasMany(LeadNote::class)
            ->where('note_type', 'appointment_result')
            ->latest();
    }

    public function project(): HasOne
    {
        return $this->hasOne(Project::class);
    }

    protected function casts(): array
    {
        return [
            'appointment_at' => 'datetime',
            'needs_financing' => 'boolean',
            'house_value' => 'decimal:2',
            'crm_qualification_completed_at' => 'datetime',
            'appointment_duration_minutes' => 'integer',
            'latitude' => 'float',
            'longitude' => 'float',
            'geocoded_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::created(function (Lead $lead): void {
            if (Schema::hasTable('lead_movements')) {
                $lead->movements()->create([
                    'from_status' => null,
                    'to_status' => $lead->status ?: 'fresh',
                    'moved_by' => auth()->id() ?: $lead->created_by,
                ]);
            }

            if (class_exists(LeadAgentAssignment::class) && Schema::hasTable('lead_agent_assignments')) {
                $lead->agentAssignments()->create([
                    'agent_id' => $lead->agent_id,
                    'assigned_by' => auth()->id() ?: $lead->created_by,
                    'is_original' => true,
                ]);
            }
        });

        static::updated(function (Lead $lead): void {
            if ($lead->wasChanged(['address', 'city', 'state', 'zip_code'])) {
                $lead->forceFill([
                    'latitude' => null,
                    'longitude' => null,
                    'geocoding_status' => 'pending',
                    'geocoded_at' => null,
                ])->saveQuietly();
            }

            $lead->sendSalesmanPushUpdates();

            if (! $lead->wasChanged('status') || ! Schema::hasTable('lead_movements')) {
                return;
            }

            $lead->movements()->create([
                'from_status' => $lead->getOriginal('status') ?: 'fresh',
                'to_status' => $lead->status ?: 'fresh',
                'moved_by' => auth()->id() ?: $lead->created_by,
            ]);
        });
    }

    private function sendSalesmanPushUpdates(): void
    {
        $assignmentChanged = $this->wasChanged(['salesman_1_id', 'salesman_2_id']);
        $appointmentChanged = $this->wasChanged('appointment_at');

        if (! $assignmentChanged && ! $appointmentChanged) {
            return;
        }

        $currentIds = array_values(array_unique(array_filter([
            $this->salesman_1_id,
            $this->salesman_2_id,
        ])));
        $previousIds = array_values(array_unique(array_filter([
            $this->getOriginal('salesman_1_id'),
            $this->getOriginal('salesman_2_id'),
        ])));
        $recipientIds = $appointmentChanged
            ? $currentIds
            : array_values(array_diff($currentIds, $previousIds));

        if ($recipientIds === []) {
            return;
        }

        $title = $appointmentChanged ? 'Appointment updated' : 'New lead assigned';
        $appointment = $this->appointment_at?->format('M j, Y \a\t g:i A');
        $body = $appointment
            ? "{$this->customer_name} — {$appointment}"
            : $this->customer_name;
        $push = app(WebPushService::class);

        Salesman::query()
            ->whereIn('salesman_id', $recipientIds)
            ->whereNotNull('account_id')
            ->pluck('account_id')
            ->each(fn (int $accountId) => $push->sendToAccount(
                $accountId,
                $title,
                $body,
                "/salesman/leads?lead={$this->id}",
            ));
    }
}
