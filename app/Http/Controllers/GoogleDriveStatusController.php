<?php

namespace App\Http\Controllers;

use App\Services\GoogleDriveProjectStorage;
use Illuminate\Http\JsonResponse;
use Throwable;

class GoogleDriveStatusController extends Controller
{
    public function __invoke(GoogleDriveProjectStorage $drive): JsonResponse
    {
        if (! $drive->configured()) {
            return response()->json([
                'configured' => false,
                'connected' => false,
                'status' => 'not_configured',
                'message' => 'Google Drive has not been configured on this server.',
                'checkedAt' => now()->toIso8601String(),
            ]);
        }

        try {
            $folder = $drive->connectionInfo();

            return response()->json([
                'configured' => true,
                'connected' => true,
                'status' => 'connected',
                'folder' => [
                    'name' => $folder['name'] ?? 'Configured Drive folder',
                ],
                'message' => 'Google Drive is connected and ready to sync project files.',
                'checkedAt' => now()->toIso8601String(),
            ]);
        } catch (Throwable $exception) {
            report($exception);

            return response()->json([
                'configured' => true,
                'connected' => false,
                'status' => 'error',
                'message' => 'Google Drive could not be reached. Check the Google authorization and try again.',
                'checkedAt' => now()->toIso8601String(),
            ], 503);
        }
    }
}
