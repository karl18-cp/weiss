<?php

namespace App\Http\Controllers;

use App\Http\Requests\ContractorRequest;
use App\Models\Contractor;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class ContractorController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('management/contractors', [
            'contractors' => Contractor::query()->orderBy('contractor')->get(),
        ]);
    }

    public function store(ContractorRequest $request): RedirectResponse
    {
        Contractor::query()->create($request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Contractor created.']);

        return back();
    }

    public function update(ContractorRequest $request, Contractor $contractor): RedirectResponse
    {
        $contractor->update($request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Contractor updated.']);

        return back();
    }

    public function destroy(Contractor $contractor): RedirectResponse
    {
        abort_unless(request()->user()?->role === 'admin', 403);

        $contractor->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Contractor deleted.']);

        return back();
    }
}
