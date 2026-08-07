<?php

namespace App\Services;

use App\Models\Project;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

class GoogleDriveProjectStorage
{
    private const FOLDER_MIME = 'application/vnd.google-apps.folder';

    public function configured(): bool
    {
        return filled(config('services.google_drive.client_id'))
            && filled(config('services.google_drive.client_secret'))
            && filled(config('services.google_drive.refresh_token'))
            && filled(config('services.google_drive.root_folder_id'));
    }

    /**
     * Mirror a locally stored project attachment to its project folder.
     *
     * @return array{id: string, name: string, webViewLink?: string}
     */
    public function mirror(Project $project, string $path, string $fileName, ?string $mimeType = null): array
    {
        if (! $this->configured()) {
            throw new RuntimeException('Google Drive is not configured.');
        }

        if (! Storage::disk('local')->exists($path)) {
            throw new RuntimeException("The local project attachment does not exist: {$path}");
        }

        $folderId = $this->projectFolderId($project);
        $existingId = $this->findFileId($folderId, $fileName);
        $stream = Storage::disk('local')->readStream($path);

        if (! is_resource($stream)) {
            throw new RuntimeException('The project attachment could not be opened for Google Drive upload.');
        }

        try {
            $metadata = ['name' => $fileName];
            if ($existingId === null) {
                $metadata['parents'] = [$folderId];
            }

            $request = $this->driveRequest()
                ->attach(
                    'metadata',
                    json_encode($metadata, JSON_THROW_ON_ERROR),
                    'metadata.json',
                    ['Content-Type' => 'application/json; charset=UTF-8'],
                )
                ->attach(
                    'file',
                    $stream,
                    $fileName,
                    ['Content-Type' => $mimeType ?: 'application/octet-stream'],
                );

            $url = $existingId === null
                ? 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink'
                : "https://www.googleapis.com/upload/drive/v3/files/{$existingId}?uploadType=multipart&fields=id,name,webViewLink";

            return $request
                ->send($existingId === null ? 'POST' : 'PATCH', $url)
                ->throw()
                ->json();
        } finally {
            fclose($stream);
        }
    }

    /** @return array{id: string, name: string, mimeType: string} */
    public function connectionInfo(): array
    {
        $folderId = (string) config('services.google_drive.root_folder_id');

        return $this->driveRequest()
            ->get("https://www.googleapis.com/drive/v3/files/{$folderId}", [
                'fields' => 'id,name,mimeType',
            ])
            ->throw()
            ->json();
    }

    /**
     * Ensure every CRM project has a folder in the configured Drive root.
     * Existing exact-name matches are left untouched.
     *
     * @param  iterable<Project>  $projects
     * @return array{created: int, skipped: int, failed: int}
     */
    public function syncProjectFolders(iterable $projects): array
    {
        if (! $this->configured()) {
            throw new RuntimeException('Google Drive is not configured.');
        }

        $rootFolderId = (string) config('services.google_drive.root_folder_id');
        $existingNames = $this->existingFolderNames($rootFolderId);
        $result = ['created' => 0, 'skipped' => 0, 'failed' => 0];

        foreach ($projects as $project) {
            $project->loadMissing('lead:id,customer_name');
            $folderName = $this->projectFolderName($project);

            if (isset($existingNames[$folderName])) {
                $result['skipped']++;

                continue;
            }

            try {
                $this->createFolder($rootFolderId, $folderName);
                $existingNames[$folderName] = true;
                $result['created']++;
            } catch (Throwable) {
                $result['failed']++;
            }
        }

        return $result;
    }

    private function projectFolderId(Project $project): string
    {
        $project->loadMissing('lead:id,customer_name');
        $folderName = $this->projectFolderName($project);
        $parentId = (string) config('services.google_drive.root_folder_id');

        if ($existingId = $this->findFileId($parentId, $folderName, self::FOLDER_MIME)) {
            return $existingId;
        }

        return $this->createFolder($parentId, $folderName);
    }

    private function projectFolderName(Project $project): string
    {
        return trim(implode(' - ', array_filter([
            $project->project_number ?: 'Project '.$project->id,
            $project->lead?->customer_name ?: $project->customer_name,
        ])));
    }

    private function createFolder(string $parentId, string $folderName): string
    {
        return (string) $this->driveRequest()
            ->post('https://www.googleapis.com/drive/v3/files', [
                'name' => $folderName,
                'mimeType' => self::FOLDER_MIME,
                'parents' => [$parentId],
            ])
            ->throw()
            ->json('id');
    }

    /** @return array<string, true> */
    private function existingFolderNames(string $parentId): array
    {
        $query = "'{$parentId}' in parents and mimeType = '".self::FOLDER_MIME."' and trashed = false";
        $names = [];
        $pageToken = null;

        do {
            $parameters = [
                'q' => $query,
                'fields' => 'nextPageToken,files(name)',
                'pageSize' => 1000,
            ];

            if ($pageToken !== null) {
                $parameters['pageToken'] = $pageToken;
            }

            $response = $this->driveRequest()
                ->get('https://www.googleapis.com/drive/v3/files', $parameters)
                ->throw()
                ->json();

            foreach ($response['files'] ?? [] as $folder) {
                if (is_string($folder['name'] ?? null)) {
                    $names[$folder['name']] = true;
                }
            }

            $pageToken = $response['nextPageToken'] ?? null;
        } while (is_string($pageToken) && $pageToken !== '');

        return $names;
    }

    private function findFileId(string $parentId, string $name, ?string $mimeType = null): ?string
    {
        $escapedName = str_replace(['\\', "'"], ['\\\\', "\\'"], $name);
        $query = "'{$parentId}' in parents and name = '{$escapedName}' and trashed = false";

        if ($mimeType !== null) {
            $query .= " and mimeType = '{$mimeType}'";
        }

        $files = $this->driveRequest()
            ->get('https://www.googleapis.com/drive/v3/files', [
                'q' => $query,
                'fields' => 'files(id,name)',
                'pageSize' => 1,
            ])
            ->throw()
            ->json('files', []);

        return $files[0]['id'] ?? null;
    }

    private function driveRequest(): PendingRequest
    {
        return Http::withToken($this->accessToken())
            ->acceptJson()
            ->timeout(45)
            ->retry(2, 300);
    }

    private function accessToken(): string
    {
        return Cache::remember('google-drive.access-token', now()->addMinutes(50), function (): string {
            $response = Http::asForm()
                ->acceptJson()
                ->timeout(20)
                ->post('https://oauth2.googleapis.com/token', [
                    'client_id' => config('services.google_drive.client_id'),
                    'client_secret' => config('services.google_drive.client_secret'),
                    'refresh_token' => config('services.google_drive.refresh_token'),
                    'grant_type' => 'refresh_token',
                ])
                ->throw();

            $token = $response->json('access_token');
            if (! is_string($token) || $token === '') {
                throw new RuntimeException('Google did not return an access token.');
            }

            return $token;
        });
    }
}
