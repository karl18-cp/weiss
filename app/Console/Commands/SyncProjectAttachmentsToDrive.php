<?php

namespace App\Console\Commands;

use App\Models\Project;
use App\Models\ProjectAccountingTransaction;
use App\Models\ProjectInvoice;
use App\Services\GoogleDriveProjectStorage;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Throwable;

class SyncProjectAttachmentsToDrive extends Command
{
    protected $signature = 'projects:sync-attachments-to-drive {--dry-run : Count eligible files without uploading them}';

    protected $description = 'Mirror existing project invoices, accounting attachments, and contracts to Google Drive';

    public function handle(GoogleDriveProjectStorage $drive): int
    {
        if (! $drive->configured()) {
            $this->error('Google Drive is not configured.');

            return self::FAILURE;
        }

        $counts = ['eligible' => 0, 'uploaded' => 0, 'missing' => 0, 'unassigned' => 0, 'failed' => 0];
        $dryRun = (bool) $this->option('dry-run');

        ProjectInvoice::query()
            ->whereNotNull('file_path')
            ->whereNotNull('file_name')
            ->with('project')
            ->chunkById(100, function ($invoices) use ($drive, $dryRun, &$counts): void {
                foreach ($invoices as $invoice) {
                    $this->sync($drive, $invoice->project, $invoice->file_path, $invoice->file_name, $invoice->file_mime, $dryRun, $counts);
                }
            });

        ProjectAccountingTransaction::query()
            ->whereNotNull('file_path')
            ->whereNotNull('file_name')
            ->with('project')
            ->chunkById(100, function ($transactions) use ($drive, $dryRun, &$counts): void {
                foreach ($transactions as $transaction) {
                    $this->sync($drive, $transaction->project, $transaction->file_path, $transaction->file_name, $transaction->file_mime, $dryRun, $counts);
                }
            });

        Project::query()
            ->whereNotNull('contract_file_path')
            ->whereNotNull('contract_file_name')
            ->chunkById(100, function ($projects) use ($drive, $dryRun, &$counts): void {
                foreach ($projects as $project) {
                    $this->sync($drive, $project, $project->contract_file_path, $project->contract_file_name, $project->contract_file_mime, $dryRun, $counts);
                }
            });

        $this->table(['Eligible', 'Uploaded', 'Missing local file', 'Unassigned', 'Failed'], [[
            $counts['eligible'], $counts['uploaded'], $counts['missing'], $counts['unassigned'], $counts['failed'],
        ]]);

        return $counts['failed'] > 0 ? self::FAILURE : self::SUCCESS;
    }

    /** @param array{eligible: int, uploaded: int, missing: int, unassigned: int, failed: int} $counts */
    private function sync(
        GoogleDriveProjectStorage $drive,
        ?Project $project,
        ?string $path,
        ?string $name,
        ?string $mime,
        bool $dryRun,
        array &$counts,
    ): void {
        if (! $project) {
            $counts['unassigned']++;

            return;
        }

        if (! $path || ! $name || ! Storage::disk('local')->exists($path)) {
            $counts['missing']++;

            return;
        }

        $counts['eligible']++;
        if ($dryRun) {
            return;
        }

        try {
            $drive->mirror($project, $path, $name, $mime);
            $counts['uploaded']++;
            $this->line("Uploaded project {$project->id}: {$name}");
        } catch (Throwable $exception) {
            $counts['failed']++;
            $this->error("Project {$project->id}, {$name}: {$exception->getMessage()}");
        }
    }
}
