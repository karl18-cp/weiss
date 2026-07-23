<?php

namespace App\Console\Commands;

use App\Services\RingCentralRecordingSync;
use Illuminate\Console\Command;

class SyncRingCentralRecordings extends Command
{
    protected $signature = 'ringcentral:sync-recordings';
    protected $description = 'Match RingCentral calls to WEISS leads and archive recordings';

    public function handle(RingCentralRecordingSync $sync): int
    {
        $this->line(json_encode($sync->sync(), JSON_PRETTY_PRINT));

        return self::SUCCESS;
    }
}
