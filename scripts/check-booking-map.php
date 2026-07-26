<?php

use App\Models\Lead;
use Illuminate\Contracts\Console\Kernel;

require dirname(__DIR__).'/vendor/autoload.php';

$app = require dirname(__DIR__).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$query = Lead::query()
    ->where('status', 'dispatched')
    ->whereNotNull('appointment_at');

echo json_encode([
    'bookings' => (clone $query)->count(),
    'mapped' => (clone $query)->whereNotNull('latitude')->whereNotNull('longitude')->count(),
    'latitude_min' => (clone $query)->min('latitude'),
    'latitude_max' => (clone $query)->max('latitude'),
    'longitude_min' => (clone $query)->min('longitude'),
    'longitude_max' => (clone $query)->max('longitude'),
], JSON_PRETTY_PRINT).PHP_EOL;
