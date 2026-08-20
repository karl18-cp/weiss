<?php

namespace App\Http\Controllers;

use App\Http\Requests\VendorRequest;
use App\Models\Vendor;
use App\Models\Contractor;
use App\Support\ManagerAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class VendorController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('management/vendors', [
            'vendors' => Vendor::query()->orderBy('vendor')->get(),
        ]);
    }

    public function importContractors(Request $request): RedirectResponse
    {
        abort_unless($request->user() && ManagerAccess::canEdit($request->user(), 'contacts_users'), 403);
        $data = $request->validate([
            'contractor_ids' => ['required', 'array', 'min:1'],
            'contractor_ids.*' => ['integer', 'distinct', Rule::exists('contractors', 'con_id')->whereNull('moved_to_vendor_at')],
        ]);

        DB::transaction(function () use ($data): void {
            Contractor::query()->whereIn('con_id', $data['contractor_ids'])->lockForUpdate()->get()
                ->each(function (Contractor $contractor): void {
                    Vendor::query()->updateOrCreate(
                        ['vendor' => $contractor->contractor],
                        [
                            'point_of_contact' => $contractor->point_of_contact,
                            'address' => $contractor->address,
                            'zip' => $contractor->zip,
                            'city' => $contractor->city,
                            'state' => $contractor->state,
                            'email' => $contractor->email,
                            'phone' => $contractor->phone,
                            'license' => $contractor->license,
                            'lic_expire' => $contractor->lic_expire,
                            'worker_comp' => $contractor->worker_comp,
                            'insurance_expire' => $contractor->insurance_expire,
                            'source_contractor_id' => $contractor->con_id,
                        ],
                    );
                    $contractor->forceFill(['moved_to_vendor_at' => now()])->save();
                });
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => count($data['contractor_ids']).' contractor(s) moved to Vendors. Existing invoice links were preserved.']);
        return back();
    }

    public function store(VendorRequest $request): RedirectResponse
    {
        Vendor::query()->create($request->validated());
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Vendor created.']);

        return back();
    }

    public function update(VendorRequest $request, Vendor $vendor): RedirectResponse
    {
        $vendor->update($request->validated());
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Vendor updated.']);

        return back();
    }

    public function destroy(Vendor $vendor): RedirectResponse
    {
        if ($vendor->projectInvoices()->exists()) {
            Inertia::flash('toast', [
                'type' => 'error',
                'message' => 'This vendor is used by invoices and cannot be deleted.',
            ]);

            return back();
        }

        $vendor->delete();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Vendor deleted.']);

        return back();
    }
}
