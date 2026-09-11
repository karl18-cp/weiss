<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use App\Models\Product;
use App\Models\Project;
use App\Models\ProjectDocument;
use App\Models\Proposal;
use App\Services\GoogleDriveProjectStorage;
use App\Support\ManagerAccess;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class ProposalController extends Controller
{
    public const STATUSES = ['Draft', 'Sent', 'Accepted', 'Declined', 'Expired'];

    public function index(Request $request): Response
    {
        return Inertia::render('management/proposals', [
            'proposals' => Proposal::query()
                ->with(['project:id,project_number', 'items', 'versions:id,proposal_id,version,file_name,created_at'])
                ->latest('updated_at')
                ->get(),
            'projects' => Project::query()
                ->with('lead:id,customer_name,email,primary_number,address,city,state,zip_code')
                ->select(['id', 'project_number', 'lead_id', 'customer_name', 'email', 'primary_number', 'address', 'city', 'state', 'zip_code'])
                ->latest('id')->get(),
            'leads' => Lead::query()
                ->select(['id', 'customer_name', 'email', 'primary_number', 'address', 'city', 'state', 'zip_code'])
                ->latest('id')->limit(1500)->get(),
            'products' => Product::query()->orderBy('product_name')->get(['prod_id', 'product_name', 'price', 'unit', 'description']),
            'statuses' => self::STATUSES,
            'canEdit' => ManagerAccess::canEdit($request->user(), 'proposals'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->authorizeEdit($request);
        $data = $this->validated($request);

        $proposal = DB::transaction(function () use ($request, $data): Proposal {
            $proposal = Proposal::query()->create([
                ...collect($data)->except('items')->all(),
                'proposal_number' => $this->nextNumber(),
                'created_by' => $request->user()->getAuthIdentifier(),
                ...$this->totals($data),
            ]);
            $this->replaceItems($proposal, $data['items']);

            return $proposal;
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => "Proposal {$proposal->proposal_number} created."]);
        return to_route('management.proposals', ['proposal' => $proposal->id]);
    }

    public function update(Request $request, Proposal $proposal): RedirectResponse
    {
        $this->authorizeEdit($request);
        $data = $this->validated($request);
        DB::transaction(function () use ($proposal, $data): void {
            $proposal->update([...collect($data)->except('items')->all(), ...$this->totals($data)]);
            $this->replaceItems($proposal, $data['items']);
        });
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Proposal saved.']);
        return back();
    }

    public function destroy(Request $request, Proposal $proposal): RedirectResponse
    {
        $this->authorizeEdit($request);
        foreach ($proposal->versions as $version) Storage::disk('local')->delete($version->file_path);
        $proposal->delete();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Proposal deleted.']);
        return to_route('management.proposals');
    }

    public function generate(Request $request, Proposal $proposal, GoogleDriveProjectStorage $drive): RedirectResponse
    {
        $this->authorizeEdit($request);
        $proposal->load(['items', 'project.lead', 'creator']);
        $versionNumber = ((int) $proposal->versions()->max('version')) + 1;
        $fileName = "{$proposal->proposal_number}-v{$versionNumber}.pdf";
        $filePath = "proposals/{$proposal->id}/{$fileName}";

        $options = new Options();
        $options->set('isRemoteEnabled', false);
        $dompdf = new Dompdf($options);
        $dompdf->loadHtml(view('pdf.proposal', ['proposal' => $proposal, 'version' => $versionNumber])->render());
        $dompdf->setPaper('letter');
        $dompdf->render();
        Storage::disk('local')->put($filePath, $dompdf->output());
        $proposal->versions()->create(['version' => $versionNumber, 'file_path' => $filePath, 'file_name' => $fileName, 'generated_by' => $request->user()->getAuthIdentifier()]);

        if ($proposal->project) {
            $document = ProjectDocument::query()->create([
                'project_id' => $proposal->project_id, 'uploaded_by' => $request->user()->getAuthIdentifier(),
                'category' => 'Proposal', 'file_path' => $filePath, 'file_name' => $fileName,
                'file_mime' => 'application/pdf', 'file_size' => Storage::disk('local')->size($filePath),
            ]);
            try {
                $mirrored = $drive->mirror($proposal->project, $filePath, $fileName, 'application/pdf');
                $document->update(['drive_file_id' => $mirrored['id'] ?? null, 'drive_url' => $mirrored['webViewLink'] ?? null]);
            } catch (Throwable $exception) {
                Log::warning('Proposal PDF Google Drive mirror failed.', ['proposal_id' => $proposal->id, 'error' => $exception->getMessage()]);
            }
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => "PDF version {$versionNumber} generated."]);
        return back();
    }

    public function download(Proposal $proposal, int $version): HttpResponse
    {
        $record = $proposal->versions()->where('version', $version)->firstOrFail();
        abort_unless(Storage::disk('local')->exists($record->file_path), 404);
        return response(Storage::disk('local')->get($record->file_path), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$record->file_name.'"',
        ]);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'project_id' => ['nullable', 'integer', 'exists:projects,id'], 'lead_id' => ['nullable', 'integer', 'exists:leads,id'],
            'customer_name' => ['required', 'string', 'max:255'], 'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'], 'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'], 'state' => ['nullable', 'string', 'max:30'], 'zip_code' => ['nullable', 'string', 'max:20'],
            'status' => ['required', Rule::in(self::STATUSES)], 'issue_date' => ['required', 'date'], 'expires_at' => ['nullable', 'date', 'after_or_equal:issue_date'],
            'scope' => ['nullable', 'string'], 'exclusions' => ['nullable', 'string'], 'payment_schedule' => ['nullable', 'string'],
            'terms' => ['nullable', 'string'], 'notes' => ['nullable', 'string'], 'discount' => ['required', 'numeric', 'min:0'], 'tax_rate' => ['required', 'numeric', 'min:0', 'max:100'],
            'items' => ['required', 'array', 'min:1'], 'items.*.product_id' => ['nullable', 'integer', 'exists:products,prod_id'],
            'items.*.name' => ['required', 'string', 'max:255'], 'items.*.description' => ['nullable', 'string'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'], 'items.*.unit' => ['nullable', 'string', 'max:50'], 'items.*.unit_price' => ['required', 'numeric', 'min:0'],
        ]);
    }

    private function totals(array $data): array
    {
        $subtotal = collect($data['items'])->sum(fn (array $item): float => round((float) $item['quantity'] * (float) $item['unit_price'], 2));
        $taxable = max(0, $subtotal - (float) $data['discount']);
        $tax = round($taxable * ((float) $data['tax_rate'] / 100), 2);
        return ['subtotal' => $subtotal, 'tax_amount' => $tax, 'total' => $taxable + $tax];
    }

    private function replaceItems(Proposal $proposal, array $items): void
    {
        $proposal->items()->delete();
        foreach (array_values($items) as $index => $item) {
            $proposal->items()->create([...$item, 'sort_order' => $index, 'total' => round((float) $item['quantity'] * (float) $item['unit_price'], 2)]);
        }
    }

    private function nextNumber(): string
    {
        $prefix = 'PRP-'.now()->format('Y').'-';
        $last = Proposal::query()->where('proposal_number', 'like', $prefix.'%')->lockForUpdate()->orderByDesc('proposal_number')->value('proposal_number');
        return $prefix.str_pad((string) (((int) substr((string) $last, -4)) + 1), 4, '0', STR_PAD_LEFT);
    }

    private function authorizeEdit(Request $request): void
    {
        abort_unless(ManagerAccess::canEdit($request->user(), 'proposals'), 403);
    }
}
