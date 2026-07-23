<?php

namespace App\Console\Commands;

use App\Services\CallToolsReportingSync;
use Illuminate\Console\Command;

class SyncCallToolsReporting extends Command
{
    protected $signature = 'calltools:sync-reporting {--pages=20 : Maximum pages per call/disposition sync}';
    protected $description = 'Synchronize CallTools calls, dispositions, agents, and daily activity metrics';

    public function handle(CallToolsReportingSync $sync): int
    {
        try {
            $result = $sync->sync(max(1, min(100, (int) $this->option('pages'))));
            $this->info(json_encode($result, JSON_PRETTY_PRINT));
            return self::SUCCESS;
        } catch (\Throwable $error) {
            $this->error($error->getMessage());
            return self::FAILURE;
        }
    }
}
