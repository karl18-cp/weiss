<?php

namespace App\Http\Controllers;

use App\Http\Requests\CompanyRequest;
use App\Models\Company;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class CompanyController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('management/contacts-users', [
            'companies' => Company::query()
                ->whereNull('archived_at')
                ->orderBy('company')
                ->get(),
            'archivedCompanies' => Company::query()
                ->whereNotNull('archived_at')
                ->orderBy('company')
                ->get(),
        ]);
    }

    public function store(CompanyRequest $request): RedirectResponse
    {
        DB::transaction(function () use ($request): void {
            $nextId = ((int) Company::query()
                ->lockForUpdate()
                ->max('com_id')) + 1;

            Company::query()->create([
                'com_id' => $nextId,
                ...$request->validated(),
                'address' => $request->validated('address') ?? '',
            ]);
        });

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Company created.',
        ]);

        return back();
    }

    public function update(CompanyRequest $request, Company $company): RedirectResponse
    {
        $company->update([
            ...$request->validated(),
            'address' => $request->validated('address') ?? '',
        ]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Company updated.',
        ]);

        return back();
    }

    public function destroy(Company $company): RedirectResponse
    {
        $company->delete();

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Company deleted.',
        ]);

        return back();
    }

    public function archive(Company $company): RedirectResponse
    {
        $company->update(['archived_at' => now()]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Company moved to Inactive.',
        ]);

        return back();
    }

    public function restore(Company $company): RedirectResponse
    {
        $company->update(['archived_at' => null]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Company restored to Active.',
        ]);

        return back();
    }
}
