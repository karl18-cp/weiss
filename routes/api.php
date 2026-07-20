<?php

use App\Http\Controllers\CallToolsWebhookController;
use Illuminate\Support\Facades\Route;

Route::post('webhooks/calltools', CallToolsWebhookController::class)
    ->middleware('throttle:120,1')
    ->name('webhooks.calltools');
