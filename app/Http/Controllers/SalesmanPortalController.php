<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\Lead;
use App\Models\LeadNote;
use App\Models\Project;
use App\Models\ProjectDocument;
use App\Services\GoogleDriveProjectStorage;
use App\Services\WebPushService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SalesmanPortalController extends Controller
{
    public function keepAlive(Request $request): JsonResponse
    {
        abort_unless($request->user()?->role === 'salesman' && $request->user()->salesman, 403);

        // Force a session write so database-backed sessions keep their
        // last_activity current even when the portal is otherwise idle.
        $request->session()->put('salesman_last_keep_alive_at', now()->timestamp);

        return response()->json(['active' => true]);
    }

    public function updateLocation(Request $request): JsonResponse
    {
        abort_unless($request->user()?->role === 'salesman' && $request->user()->salesman, 403);

        $data = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'accuracy' => ['nullable', 'numeric', 'min:0', 'max:100000'],
        ]);

        $request->user()->salesman->update([
            'live_latitude' => $data['latitude'],
            'live_longitude' => $data['longitude'],
            'live_location_accuracy' => isset($data['accuracy']) ? (int) round($data['accuracy']) : null,
            'live_location_updated_at' => now(),
        ]);

        return response()->json(['updated_at' => now()->toIso8601String()]);
    }

    public function leads(Request $request): Response
    {
        $user = $request->user();
        abort_unless($user?->role === 'salesman', 403);

        $salesmanId = $user->salesman?->salesman_id;
        abort_unless($salesmanId, 403, 'Your account is not linked to a salesman profile.');

        $leads = $this->assignedLeadsQuery($salesmanId)
            ->whereNotIn('status', ['kit', 'kit_ng', 'kit_toss', 'kit_cb'])
            ->select([
                'id',
                'customer_name',
                'primary_number',
                'mobile_number',
                'address',
                'city',
                'state',
                'zip_code',
                'appointment_at',
                'company_id',
                'product_id',
            ])
            ->with([
                'company:com_id,company',
                'product:prod_id,product_name',
            ])
            ->orderByRaw('appointment_at IS NULL')
            ->orderBy('appointment_at')
            ->orderByDesc('id')
            ->get();

        return $this->renderLeadList($leads, $user->salesman->salesman_name, $salesmanId, 'leads');
    }

    public function followUps(Request $request): Response
    {
        $user = $request->user();
        abort_unless($user?->role === 'salesman', 403);

        $salesmanId = $user->salesman?->salesman_id;
        abort_unless($salesmanId, 403, 'Your account is not linked to a salesman profile.');

        $leads = $this->assignedLeadsQuery($salesmanId)
            ->whereIn('status', ['kit', 'kit_ng', 'kit_toss', 'kit_cb'])
            ->select([
                'id',
                'customer_name',
                'primary_number',
                'mobile_number',
                'address',
                'city',
                'state',
                'zip_code',
                'appointment_at',
                'company_id',
                'product_id',
            ])
            ->with([
                'company:com_id,company',
                'product:prod_id,product_name',
            ])
            ->orderByRaw('appointment_at IS NULL')
            ->orderBy('appointment_at')
            ->orderByDesc('id')
            ->get();

        return $this->renderLeadList($leads, $user->salesman->salesman_name, $salesmanId, 'follow-ups');
    }

    public function sold(Request $request): Response
    {
        $user = $request->user();
        abort_unless($user?->role === 'salesman', 403);

        $salesmanId = $user->salesman?->salesman_id;
        abort_unless($salesmanId, 403, 'Your account is not linked to a salesman profile.');

        $leads = $this->assignedLeadsQuery($salesmanId)
            ->whereHas('project')
            ->select([
                'id', 'customer_name', 'primary_number', 'mobile_number', 'address', 'city',
                'state', 'zip_code', 'appointment_at', 'company_id', 'product_id',
            ])
            ->with([
                'company:com_id,company',
                'product:prod_id,product_name',
                'project:id,lead_id,project_number,amount,status',
            ])
            ->orderByDesc(
                Project::query()->select('created_at')->whereColumn('projects.lead_id', 'leads.id')->limit(1),
            )
            ->get();

        return $this->renderLeadList($leads, $user->salesman->salesman_name, $salesmanId, 'sold');
    }

    public function soldProject(Request $request, Project $project): Response
    {
        $salesmanId = $this->salesmanId($request);
        $this->ensureSalesmanProject($project, $salesmanId);

        $project->load([
            'lead:id,customer_name,address,city,state,zip_code,appointment_at,product_id,company_id',
            'lead.product:prod_id,product_name', 'lead.company:com_id,company',
            'sales.product:prod_id,product_name', 'documents:id,project_id,category,file_name,file_mime,file_size,created_at',
        ]);

        return Inertia::render('salesman/sold-project', ['project' => $project]);
    }

    public function storeProjectDocument(Request $request, Project $project, GoogleDriveProjectStorage $drive): RedirectResponse
    {
        $salesmanId = $this->salesmanId($request);
        $this->ensureSalesmanProject($project, $salesmanId);
        $data = $request->validate([
            'files' => ['required', 'array', 'min:1', 'max:20'],
            'files.*' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png,webp,heic,heif', 'max:20480'],
        ]);

        $driveFailures = 0;
        foreach ($data['files'] as $file) {
            $path = $file->store("project-documents/{$project->id}", 'local');
            $document = $project->documents()->create([
                'uploaded_by' => $request->user()->getAuthIdentifier(),
                'category' => 'Salesman Upload',
                'file_path' => $path,
                'file_name' => $file->getClientOriginalName(),
                'file_mime' => $file->getMimeType(),
                'file_size' => $file->getSize(),
            ]);

            try {
                $mirrored = $drive->mirror($project, $path, $document->file_name, $document->file_mime);
                $document->update(['drive_file_id' => $mirrored['id'] ?? null, 'drive_url' => $mirrored['webViewLink'] ?? null]);
            } catch (Throwable $exception) {
                $driveFailures++;
                Log::warning('Salesman project document Drive sync failed.', ['project_id' => $project->id, 'document_id' => $document->id, 'error' => $exception->getMessage()]);
            }
        }

        Inertia::flash('toast', [
            'type' => $driveFailures ? 'warning' : 'success',
            'message' => $driveFailures ? 'Files saved in CRM; some Google Drive uploads need retrying.' : 'Project files uploaded to CRM and Google Drive.',
        ]);
        return back();
    }

    public function showProjectDocument(Request $request, Project $project, ProjectDocument $document): StreamedResponse
    {
        $this->ensureSalesmanProject($project, $this->salesmanId($request));
        abort_unless($document->project_id === $project->id && Storage::disk('local')->exists($document->file_path), 404);

        return Storage::disk('local')->response($document->file_path, $document->file_name, ['Content-Disposition' => 'inline']);
    }

    private function salesmanId(Request $request): int
    {
        abort_unless($request->user()?->role === 'salesman' && $request->user()->salesman, 403);
        return (int) $request->user()->salesman->salesman_id;
    }

    private function ensureSalesmanProject(Project $project, int $salesmanId): void
    {
        abort_unless($project->lead && ($project->lead->salesman_1_id === $salesmanId || $project->lead->salesman_2_id === $salesmanId), 403);
    }

    private function renderLeadList($leads, string $salesmanName, int $salesmanId, string $mode): Response
    {
        return Inertia::render('salesman/leads', [
            'leads' => $leads,
            'salesman' => [
                'id' => $salesmanId,
                'name' => $salesmanName,
            ],
            'mode' => $mode,
            'pushPublicKey' => config('services.webpush.public_key'),
        ]);
    }

    public function leadInformation(Request $request): Response
    {
        $user = $request->user();
        abort_unless($user?->role === 'salesman', 403);

        $salesmanId = $user->salesman?->salesman_id;
        abort_unless($salesmanId, 403, 'Your account is not linked to a salesman profile.');

        $requestedLeadId = $request->integer('lead');
        $leadQuery = $this->assignedLeadsQuery($salesmanId)
            ->select([
                'id',
                'customer_name',
                'primary_number',
                'mobile_number',
                'address',
                'city',
                'state',
                'zip_code',
                'appointment_at',
                'company_id',
                'product_id',
            ])
            ->with([
                'company:com_id,company',
                'product:prod_id,product_name',
                'notes' => fn ($query) => $query
                    ->where('note_type', 'dispatch')
                    ->latest()
                    ->limit(1),
            ])
            ->orderByRaw('appointment_at IS NULL')
            ->orderBy('appointment_at')
            ->orderByDesc('id');

        $lead = $requestedLeadId
            ? (clone $leadQuery)->whereKey($requestedLeadId)->first()
            : $leadQuery->first();

        if ($requestedLeadId) {
            abort_unless($lead, 404);
        }

        return Inertia::render('salesman/lead-information', [
            'lead' => $lead,
            'dispatchNote' => $lead?->notes->first()?->body,
            'salesman' => [
                'id' => $salesmanId,
                'name' => $user->salesman->salesman_name,
            ],
        ]);
    }

    public function storeAppointmentResultNote(
        Request $request,
        Lead $lead,
        WebPushService $push,
        \App\Services\ProjectNumberAllocator $projectNumbers,
        GoogleDriveProjectStorage $googleDrive,
    ): RedirectResponse
    {
        $user = $request->user();
        abort_unless($user?->role === 'salesman', 403);

        $salesmanId = $user->salesman?->salesman_id;
        abort_unless($salesmanId, 403, 'Your account is not linked to a salesman profile.');
        abort_unless(
            $lead->salesman_1_id === $salesmanId || $lead->salesman_2_id === $salesmanId,
            403
        );

        $validated = $request->validate([
            'body' => ['nullable', 'required_without:action', 'string', 'max:5000'],
            'action' => ['nullable', 'required_without:body', 'string', 'in:on_my_way,sold,not_sold,follow_up'],
            'sale_amount' => ['nullable', 'required_if:action,sold', 'numeric', 'min:0.01', 'max:999999999.99'],
            'contract_file' => [
                'nullable', 'required_if:action,sold', 'file', 'max:20480',
                'mimes:pdf,jpg,jpeg,png,webp,heic,heif',
            ],
        ]);

        $actionLabels = [
            'on_my_way' => 'On My Way',
            'sold' => 'Sold',
            'not_sold' => 'Not Sold',
            'follow_up' => 'My Follow Ups',
        ];
        $action = $validated['action'] ?? null;
        $saleAmount = $action === 'sold' ? (float) $validated['sale_amount'] : null;
        $body = $action !== null
            ? 'Salesman update: '.$actionLabels[$action]
            : trim((string) ($validated['body'] ?? ''));

        if ($saleAmount !== null) {
            $body .= ' — Sale amount: $'.number_format($saleAmount, 2);
        }

        $soldProject = DB::transaction(function () use ($request, $lead, $body, $user, $action, $saleAmount, $projectNumbers): ?Project {
            LeadNote::query()->create([
                'lead_id' => $lead->id,
                'note_type' => 'appointment_result',
                'body' => $body,
                'created_by' => $user->getAuthIdentifier(),
            ]);

            if ($action !== null) {
                LeadNote::query()->create([
                    'lead_id' => $lead->id,
                    'note_type' => 'dispatch',
                    'body' => $body,
                    'created_by' => $user->getAuthIdentifier(),
                ]);
            }

            if ($action === 'sold') {
                $project = Project::query()->firstOrNew(['lead_id' => $lead->id]);
                $project->fill([
                    'amount' => $saleAmount,
                    'status' => 'new',
                    'project_number' => $project->exists
                        ? $project->project_number
                        : ($lead->company_id ? $projectNumbers->allocate($lead) : null),
                    'created_by' => $user->getAuthIdentifier(),
                ])->save();

                $file = $request->file('contract_file');
                $path = $file->store("project-contracts/{$project->id}", 'local');
                $project->update([
                    'contract_file_path' => $path,
                    'contract_file_name' => $file->getClientOriginalName(),
                    'contract_file_mime' => $file->getMimeType(),
                    'contract_file_size' => $file->getSize(),
                ]);
                $project->sales()->updateOrCreate(
                    ['type' => 'original'],
                    [
                        'amount' => $saleAmount,
                        'sale_date' => now()->toDateString(),
                        'product_id' => $lead->product_id,
                    ],
                );
                $lead->update([
                    'status' => 'project',
                    'appointment_result' => 'Sold',
                ]);

                return $project;
            }

            if ($action === 'follow_up') {
                $lead->update(['status' => 'kit']);
            }

            return null;
        });

        $driveSync = null;
        if ($soldProject && $googleDrive->configured()) {
            try {
                $googleDrive->mirror(
                    $soldProject,
                    $soldProject->contract_file_path,
                    $soldProject->contract_file_name,
                    $soldProject->contract_file_mime,
                );
                $driveSync = true;
            } catch (Throwable $exception) {
                $driveSync = false;
                Log::error('Salesman contract Google Drive sync failed.', [
                    'project_id' => $soldProject->id,
                    'file_path' => $soldProject->contract_file_path,
                    'exception' => $exception,
                ]);
            }
        }

        if ($action !== null) {
            $salesmanName = $user->salesman->salesman_name;
            $title = "{$salesmanName}: {$actionLabels[$action]}";
            $notificationBody = "{$lead->customer_name} — {$lead->address}, {$lead->city}";

            $destination = $action === 'follow_up'
                ? "/lead-workflow/keep-in-touch?lead={$lead->id}"
                : "/lead-workflow/dispatch-leads?lead={$lead->id}";

            Account::query()
                ->whereIn('role', ['admin', 'manager'])
                ->pluck('acc_id')
                ->each(fn (int $accountId) => $push->sendToAccount(
                    $accountId,
                    $title,
                    $notificationBody,
                    $destination,
                ));
        }

        Inertia::flash('toast', [
            'type' => $driveSync === false ? 'warning' : 'success',
            'message' => $action !== null
                ? match ($driveSync) {
                    true => "{$actionLabels[$action]} status sent. The contract was uploaded to the project's Google Drive folder.",
                    false => "{$actionLabels[$action]} status sent, but Google Drive sync failed. The CRM copy is safe.",
                    null => "{$actionLabels[$action]} status sent to managers and admins.",
                }
                : 'Appointment result note saved.',
        ]);

        return $action === 'follow_up'
            ? to_route('salesman.follow-ups')
            : back();
    }

    private function assignedLeadsQuery(int $salesmanId): Builder
    {
        return Lead::query()->where(function ($query) use ($salesmanId): void {
            $query->where('salesman_1_id', $salesmanId)
                ->orWhere('salesman_2_id', $salesmanId);
        });
    }
}
