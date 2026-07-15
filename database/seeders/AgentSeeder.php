<?php

namespace Database\Seeders;

use App\Models\Agent;
use Illuminate\Database\Seeder;

class AgentSeeder extends Seeder
{
    public function run(): void
    {
        $agents = [
            'Aaron Q.',
            'Archie P.',
            'Carla U.',
            'Cedrick D.',
            'Charles V.',
            'Christian S.',
            'Christian T.',
            'Daiselyn F.',
            'Dee F.',
            'Enrique S.',
            'Fernando F.',
            'Florielyn R.',
            'Frances T.',
            'Francis T.',
            'Gabriel P.',
            'Ian B.',
            'Jay J. R.',
            'Jean R',
            'Jemuel D.',
            'John P. R.',
            'Joseph C.',
            'Judy D.',
            'Kim A. P.',
            'Lea D.',
            'Lexie B.',
            'Mark C. T.',
            'Mark T.',
            'Mary R. P.',
            'Paul R.',
            'Ron W.',
            'Rose U.',
            'Sigrid D.',
            'Warren G.',
            'Wenny G.',
            'Wes A.',
            'Zara C.',
        ];

        foreach ($agents as $agent) {
            Agent::query()->firstOrCreate(['agent_name' => $agent]);
        }
    }
}
