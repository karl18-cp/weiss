<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use App\Models\RingCentralCall;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class RingCentralRecordingController extends Controller
{
    public function __invoke(Lead $lead, RingCentralCall $ringCentralCall): StreamedResponse
    {
        abort_unless($ringCentralCall->lead_id === $lead->id && $ringCentralCall->recording_path, 404);
        abort_unless(Storage::disk('local')->exists($ringCentralCall->recording_path), 404);

        return Storage::disk('local')->response(
            $ringCentralCall->recording_path,
            "lead-{$lead->id}-call-{$ringCentralCall->id}.mp3",
            ['Content-Type' => $ringCentralCall->recording_content_type ?: 'audio/mpeg'],
        );
    }
}
