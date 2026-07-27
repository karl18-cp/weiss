<?php

use App\Services\CallToolsReportingSync;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

test('reporting sync imports historical CallTools login shifts', function () {
    config([
        'services.calltools.api_base_url' => 'https://calltools.test',
        'services.calltools.api_key' => 'test-key',
        'services.calltools.sync_start_date' => '2026-07-01',
    ]);

    Http::fake(function (Request $request) {
        if (str_contains($request->url(), '/api/userloginshifts/')) {
            return Http::response([
                'results' => [[
                    'id' => 9001,
                    'app_user' => '27d88035-4c66-4d8e-b0d3-2481e0ed7dd2',
                    'start' => '2026-07-10T12:00:00Z',
                    'stop' => '2026-07-10T20:30:00Z',
                    'duration' => 30600,
                    'created_on' => '2026-07-10T12:00:00Z',
                ]],
                'next' => null,
            ]);
        }

        return Http::response(['results' => [], 'next' => null]);
    });

    $result = app(CallToolsReportingSync::class)->sync(1);

    expect($result['login_shifts']['processed'])->toBe(1);
    $this->assertDatabaseHas('calltools_user_login_shifts', [
        'calltools_id' => '9001',
        'app_user_id' => '27d88035-4c66-4d8e-b0d3-2481e0ed7dd2',
        'started_at' => '2026-07-10 12:00:00',
        'stopped_at' => '2026-07-10 20:30:00',
        'duration_seconds' => 30600,
    ]);
});

test('login shift sync closes overlapping sessions when CallTools reports logout', function () {
    config([
        'services.calltools.api_base_url' => 'https://calltools.test',
        'services.calltools.api_key' => 'test-key',
        'services.calltools.sync_start_date' => '2026-07-01',
    ]);
    CarbonImmutable::setTestNow('2026-07-27 18:00:00 UTC');

    DB::table('calltools_user_login_shifts')->insert([
        [
            'calltools_id' => '9001',
            'app_user_id' => 'agent-1',
            'started_at' => '2026-07-27 08:00:00',
            'stopped_at' => null,
            'duration_seconds' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ],
        [
            'calltools_id' => '9002',
            'app_user_id' => 'agent-1',
            'started_at' => '2026-07-27 13:00:00',
            'stopped_at' => null,
            'duration_seconds' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ],
    ]);

    Http::fake(function (Request $request) {
        if (str_contains($request->url(), '/api/agentstatuses/')) {
            return Http::response([
                'results' => [[
                    'app_user' => 'agent-1',
                    'full_name' => 'Agent One',
                    'logged_in' => false,
                    'agent_status_modified_on' => '2026-07-27T17:45:00Z',
                ]],
            ]);
        }

        return Http::response(['results' => [], 'next' => null]);
    });

    app(CallToolsReportingSync::class)->syncLoginShifts();

    $this->assertDatabaseHas('calltools_user_login_shifts', [
        'calltools_id' => '9001',
        'stopped_at' => '2026-07-27 13:00:00',
        'duration_seconds' => 18000,
    ]);
    $this->assertDatabaseHas('calltools_user_login_shifts', [
        'calltools_id' => '9002',
        'stopped_at' => '2026-07-27 17:45:00',
        'duration_seconds' => 17100,
    ]);
});
