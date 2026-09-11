<?php

namespace App\Observers;

use App\Models\Project;
use App\Models\ProjectActivityLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Arr;

class ProjectActivityObserver
{
    private const HIDDEN = ['created_at', 'updated_at', 'file_path', 'drive_file_id'];

    public function created(Model $subject): void
    {
        $this->record($subject, 'created', [], $subject->getAttributes());
    }

    public function updated(Model $subject): void
    {
        $changes = Arr::except($subject->getChanges(), self::HIDDEN);
        if ($changes === []) return;

        $old = [];
        foreach (array_keys($changes) as $key) $old[$key] = $subject->getOriginal($key);
        $this->record($subject, 'updated', $old, $changes);
    }

    public function deleted(Model $subject): void
    {
        if ($subject instanceof Project) return;
        $this->record($subject, 'deleted', $subject->getAttributes(), []);
    }

    private function record(Model $subject, string $action, array $old, array $new): void
    {
        $projectId = $subject instanceof Project ? $subject->getKey() : $subject->getAttribute('project_id');
        if (! $projectId) return;

        $label = match (class_basename($subject)) {
            'Project' => 'Project',
            'ProjectSale' => ucfirst((string) $subject->getAttribute('type')).' sale',
            'ProjectInvoice' => 'Invoice '.($subject->getAttribute('invoice_number') ?: ''),
            'ProjectAccountingTransaction' => ucfirst((string) $subject->getAttribute('type')).' '.($subject->getAttribute('reference_number') ?: ''),
            'ProjectDocument' => 'Document '.($subject->getAttribute('file_name') ?: ''),
            'ScheduledPayment' => 'Scheduled payment',
            default => class_basename($subject),
        };

        ProjectActivityLog::query()->create([
            'project_id' => $projectId,
            'actor_id' => auth()->id(),
            'subject_type' => class_basename($subject),
            'subject_id' => $subject->getKey(),
            'action' => $action,
            'description' => trim($label).' '.$action,
            'old_values' => $this->clean($old),
            'new_values' => $this->clean($new),
        ]);
    }

    private function clean(array $values): array
    {
        return collect(Arr::except($values, self::HIDDEN))
            ->map(fn ($value) => $value instanceof \DateTimeInterface ? $value->format('Y-m-d H:i:s') : $value)
            ->all();
    }
}
