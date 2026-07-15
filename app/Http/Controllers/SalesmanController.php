<?php

namespace App\Http\Controllers;

use App\Http\Requests\SalesmanRequest;
use App\Models\Salesman;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class SalesmanController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('management/salesmen', [
            'salesmen' => Salesman::query()->orderBy('salesman_name')->get(),
        ]);
    }

    public function store(SalesmanRequest $request): RedirectResponse
    {
        Salesman::query()->create($request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Salesman created.']);

        return back();
    }

    public function update(SalesmanRequest $request, Salesman $salesman): RedirectResponse
    {
        $salesman->update($request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Salesman updated.']);

        return back();
    }

    public function destroy(Salesman $salesman): RedirectResponse
    {
        abort_unless(request()->user()?->role === 'admin', 403);

        $salesman->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Salesman deleted.']);

        return back();
    }
}
