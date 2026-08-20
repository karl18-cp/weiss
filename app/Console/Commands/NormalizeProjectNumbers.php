<?php

namespace App\Console\Commands;

use App\Models\Project;
use Illuminate\Console\Command;

class NormalizeProjectNumbers extends Command
{
    protected $signature = 'projects:normalize-numbers {--dry-run : Show changes without updating projects}';

    protected $description = 'Normalize existing project numbers to COMPANY#NUMBER';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $counts = ['eligible' => 0, 'updated' => 0, 'already_valid' => 0, 'missing_company' => 0, 'conflicts' => 0];

        Project::query()
            ->with(['lead.company:com_id,prefix', 'company:com_id,prefix'])
            ->chunkById(100, function ($projects) use ($dryRun, &$counts): void {
                foreach ($projects as $project) {
                    $current = trim((string) $project->project_number);
                    if ($current === '' || preg_match('/^[A-Z0-9]+#\d+(?:\.\d+)?$/i', $current)) {
                        $counts['already_valid']++;
                        continue;
                    }

                    if (preg_match('/^[A-Z0-9]+#\s*(\d+)$/i', $current, $matches)) {
                        $digits = $matches[1];
                    } elseif (preg_match('/^\d+$/', $current)) {
                        $digits = $current;
                    } else {
                        $counts['already_valid']++;
                        continue;
                    }

                    $prefix = strtoupper(trim((string) ($project->lead?->company?->prefix ?: $project->company?->prefix), " #-_\t\n\r\0\x0B"));
                    if ($prefix === '') {
                        $counts['missing_company']++;
                        continue;
                    }

                    $normalized = $prefix.'#'.$digits;
                    if (Project::query()->where('project_number', $normalized)->whereKeyNot($project->id)->exists()) {
                        $counts['conflicts']++;
                        $this->warn("Conflict: project {$project->id} {$current} -> {$normalized}");
                        continue;
                    }

                    $counts['eligible']++;
                    $this->line("Project {$project->id}: {$current} -> {$normalized}");
                    if (! $dryRun) {
                        $project->update(['project_number' => $normalized]);
                        $counts['updated']++;
                    }
                }
            });

        $this->table(
            ['Eligible', 'Updated', 'Already valid/blank', 'Missing company abbreviation', 'Conflicts'],
            [[$counts['eligible'], $counts['updated'], $counts['already_valid'], $counts['missing_company'], $counts['conflicts']]],
        );

        return self::SUCCESS;
    }
}
