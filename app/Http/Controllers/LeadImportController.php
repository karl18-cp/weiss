<?php

namespace App\Http\Controllers;

use App\Services\LeadSpreadsheetImporter;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use RuntimeException;

class LeadImportController extends Controller
{
    public function __invoke(Request $request, LeadSpreadsheetImporter $importer): RedirectResponse
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx', 'max:20480'],
        ]);

        try {
            $result = $importer->import(
                $data['file'],
                (int) $request->user()->getAuthIdentifier(),
            );
        } catch (RuntimeException $exception) {
            return back()->withErrors(['file' => $exception->getMessage()]);
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => "Imported {$result['imported']} leads and updated telemarketer notes on {$result['notes_updated']} existing leads.",
        ]);

        return back()->with('importResult', $result);
    }
}
