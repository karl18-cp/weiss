<?php

namespace App\Http\Controllers;

use App\Models\SystemTask;
use App\Support\ManagerAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TaskController extends Controller
{
    private const STATUSES = ['Pending', 'Finished', 'Cancelled'];

    public function index(Request $request): Response
    {
        return Inertia::render('management/tasks', [
            'tasks' => SystemTask::query()
                ->with(['creator:acc_id,username', 'updater:acc_id,username'])
                ->latest()
                ->get()
                ->map(fn (SystemTask $task) => [
                    'id' => $task->id,
                    'title' => $task->title,
                    'description' => $task->description,
                    'status' => $task->status,
                    'created_by' => $task->creator?->username,
                    'updated_by' => $task->updater?->username,
                    'updated_at' => $task->updated_at?->toIso8601String(),
                ]),
            'statuses' => self::STATUSES,
            'canEdit' => ManagerAccess::canEdit($request->user(), 'tasks'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);
        $data['created_by'] = $request->user()->acc_id;
        $data['updated_by'] = $request->user()->acc_id;
        SystemTask::create($data);

        return back()->with('success', 'Task created.');
    }

    public function update(Request $request, SystemTask $systemTask): RedirectResponse
    {
        $data = $this->validated($request);
        $data['updated_by'] = $request->user()->acc_id;
        $systemTask->update($data);

        return back()->with('success', 'Task updated.');
    }

    public function destroy(SystemTask $systemTask): RedirectResponse
    {
        $systemTask->delete();

        return back()->with('success', 'Task deleted.');
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:10000'],
            'status' => ['required', Rule::in(self::STATUSES)],
        ]);
    }
}
