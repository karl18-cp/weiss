<?php

namespace App\Console\Commands;

use App\Models\Lead;
use App\Services\LeadGeocodingService;
use Illuminate\Console\Command;

class GeocodeLeads extends Command
{
    protected $signature = 'leads:geocode
        {--limit=100 : Maximum leads to process}
        {--retry-failed : Include previously failed addresses}
        {--all : Include leads that are not active bookings}';

    protected $description = 'Geocode lead addresses that do not have map coordinates';

    public function handle(LeadGeocodingService $geocoder): int
    {
        if (! config('services.maptiler.api_key')) {
            $this->error('MAPTILER_API_KEY is not configured.');

            return self::FAILURE;
        }

        $statuses = [null, 'pending'];
        if ($this->option('retry-failed')) {
            $statuses[] = 'failed';
        }

        $leads = Lead::query()
            ->when(! $this->option('all'), fn ($query) => $query
                ->where('status', 'dispatched')
                ->whereNotNull('appointment_at'))
            ->whereNull('latitude')
            ->whereNull('longitude')
            ->where(function ($query) use ($statuses): void {
                $query->whereNull('geocoding_status')
                    ->orWhereIn('geocoding_status', array_filter($statuses));
            })
            ->oldest('id')
            ->limit(max(1, (int) $this->option('limit')))
            ->get();

        if ($leads->isEmpty()) {
            $this->info('No lead addresses need geocoding.');

            return self::SUCCESS;
        }

        $successful = 0;
        $bar = $this->output->createProgressBar($leads->count());
        foreach ($leads as $lead) {
            $successful += $geocoder->geocode($lead) ? 1 : 0;
            $bar->advance();
        }
        $bar->finish();
        $this->newLine(2);
        $this->info("Geocoded {$successful} of {$leads->count()} leads.");

        return $successful === $leads->count() ? self::SUCCESS : self::FAILURE;
    }
}
