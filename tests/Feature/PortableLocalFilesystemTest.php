<?php

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

test('local file uploads use the extension based portable storage driver', function () {
    $root = storage_path('framework/testing/disks/portable-local');
    config()->set('filesystems.disks.local.root', $root);
    Storage::forgetDisk('local');

    $path = UploadedFile::fake()->create('receipt.pdf', 10, 'application/pdf')
        ->store('project-accounting/5277', 'local');

    expect($path)->not->toBeFalse()
        ->and(Storage::disk('local')->exists($path))->toBeTrue();

    Storage::disk('local')->deleteDirectory('project-accounting');
});
