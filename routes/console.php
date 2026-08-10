<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('calltools:sync-reporting --pages=20')
    ->everyFiveMinutes()
    ->withoutOverlapping(15);

Schedule::command('calltools:sync-login-shifts --pages=2')
    ->everyMinute()
    ->withoutOverlapping(3);

Schedule::command('ringcentral:sync-recordings')
    ->everyFiveMinutes()
    ->withoutOverlapping(10);

Schedule::command('leads:geocode --all --limit=25')
    ->everyMinute()
    ->withoutOverlapping(5);

Schedule::command('push:appointment-reminders')
    ->everyMinute()
    ->withoutOverlapping(5);
