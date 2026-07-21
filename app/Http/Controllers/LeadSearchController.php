<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LeadSearchController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $query = trim((string) $request->query('q', ''));
        if (mb_strlen($query) < 2) {
            return response()->json(['data' => []]);
        }

        $digits = preg_replace('/\D+/', '', $query) ?: '';
        $leads = Lead::query()
            ->with(['company:com_id,company', 'product:prod_id,product_name'])
            ->where(function ($builder) use ($query, $digits): void {
                $like = '%'.$query.'%';
                $builder->where('customer_name', 'like', $like)
                    ->orWhere('address', 'like', $like)->orWhere('city', 'like', $like)
                    ->orWhere('state', 'like', $like)->orWhere('zip_code', 'like', $like)
                    ->orWhere('email', 'like', $like)->orWhere('primary_number', 'like', $like)
                    ->orWhere('secondary_number', 'like', $like)->orWhere('mobile_number', 'like', $like);
                if (strlen($digits) >= 3) {
                    foreach (['primary_number', 'secondary_number', 'mobile_number'] as $column) {
                        $builder->orWhereRaw("REPLACE(REPLACE(REPLACE(REPLACE(REPLACE($column, ' ', ''), '-', ''), '(', ''), ')', ''), '+', '') LIKE ?", ['%'.$digits.'%']);
                    }
                }
            })
            ->latest()->limit(30)->get()
            ->map(fn (Lead $lead): array => $this->result($lead))
            ->filter(fn (array $result): bool => $this->canAccess($request, $result['module']))
            ->take(10)->values();

        return response()->json(['data' => $leads]);
    }

    private function result(Lead $lead): array
    {
        [$location, $path, $module] = match ($lead->status) {
            'confirmed' => ['Confirm Leads', '/lead-workflow/confirm-leads', 'confirm_leads'],
            'dispatched' => ['Dispatch Leads', '/lead-workflow/dispatch-leads', 'dispatch_leads'],
            'reschedule' => ['Reschedule', '/lead-workflow/reschedule', 'reschedule'],
            'rehash', 'rehash_ng', 'rehash_toss', 'rehash_cb' => ['Rehash', '/lead-workflow/rehash', 'rehash'],
            '555' => ['555', '/lead-workflow/555', '555'],
            'la' => ['LA', '/lead-workflow/la', 'la'],
            'his' => ['HIS', '/lead-workflow/his', 'his'],
            'kit', 'kit_ng', 'kit_toss', 'kit_cb' => ['Keep in Touch', '/lead-workflow/keep-in-touch', 'keep_in_touch'],
            'project', 'sold', 'sale' => ['Projects', '/management/projects', 'projects'],
            default => ['Leads Shop', '/lead-workflow/leads-shop', 'leads_shop'],
        };

        return [
            'id' => $lead->id, 'customer' => $lead->customer_name,
            'phone' => $lead->primary_number ?: ($lead->mobile_number ?: $lead->secondary_number),
            'address' => collect([$lead->address, $lead->city, $lead->state, $lead->zip_code])->filter()->implode(', '),
            'product' => $lead->product?->product_name, 'company' => $lead->company?->company,
            'location' => $location, 'module' => $module, 'url' => $path.'?lead='.$lead->id,
        ];
    }

    private function canAccess(Request $request, string $module): bool
    {
        $user = $request->user();
        if (! $user || $user->role !== 'manager') return true;

        return in_array($user->manager?->permissions()->where('module', $module)->value('access_level') ?? 'none', ['view', 'edit'], true);
    }
}
