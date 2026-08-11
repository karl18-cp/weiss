<?php

namespace App\Console\Commands;

use App\Services\RingCentralRecordingSync;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

class SyncRingCentralRecordings extends Command
{
    protected $signature = 'ringcentral:sync-recordings
        {--from= : UTC/ISO start date for call-log backfill}
        {--to= : UTC/ISO end date for call-log backfill}
        {--download-limit=20 : Maximum recordings to download in this run}';
    protected $description = 'Match RingCentral calls to WEISS leads and archive recordings';

    public function handle(RingCentralRecordingSync $sync): int
    {
        $from = $this->option('from') ? CarbonImmutable::parse((string) $this->option('from'))->utc() : null;
        $to = $this->option('to') ? CarbonImmutable::parse((string) $this->option('to'))->utc() : null;
        $this->line(json_encode($sync->sync($from, $to, max(1, (int) $this->option('download-limit'))), JSON_PRETTY_PRINT));

        return self::SUCCESS;
    }
}
