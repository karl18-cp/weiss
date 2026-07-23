<?php

namespace App\Console\Commands;

use App\Services\CallToolsReportingSync;
use Illuminate\Console\Command;

class SyncCallToolsLoginShifts extends Command
{
    protected $signature = 'calltools:sync-login-shifts {--pages=2 : Maximum pages to refresh}';
    protected $description = 'Refresh recent CallTools user login sessions';

    public function handle(CallToolsReportingSync $sync): int
    {
        try {
            $result = $sync->syncLoginShifts(max(1, min(10, (int) $this->option('pages'))));
            $this->info(json_encode($result, JSON_PRETTY_PRINT));

            return self::SUCCESS;
        } catch (\Throwable $error) {
            $this->error($error->getMessage());

            return self::FAILURE;
        }
    }
}
