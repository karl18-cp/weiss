<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class CaliforniaServiceAreas
{
    private const COUNTIES = [
        'Alameda County' => ['Fremont','Hayward','Newark','San Leandro','Dublin','Pleasanton','Alameda','Oakland','Piedmont','Livermore','Emeryville','Berkeley','Albany','Union City'],
        'Santa Clara County' => ['Milpitas','Palo Alto','Mountain View','Sunnyvale','Los Altos','San Jose','Santa Clara','Cupertino','Los Altos Hills','Campbell','Saratoga','Los Gatos','Monte Sereno','Morgan Hill','Gilroy'],
        'San Francisco County' => ['San Francisco'],
        'San Mateo County' => ['East Palo Alto','Menlo Park','Atherton','Redwood City','Foster City','San Carlos','San Mateo','Woodside','Belmont','Hillsborough','Burlingame','Millbrae','San Bruno','Half Moon Bay','Brisbane','South San Francisco','Colma','Daly City','Pacifica','Portola Valley'],
        'Contra Costa County' => ['San Ramon','Danville','Moraga','Orinda','Lafayette','Walnut Creek','El Cerrito','Pleasant Hill','Concord','Richmond','San Pablo','Clayton','Hercules','Martinez','Pinole','Pittsburg','Antioch','Oakley','Brentwood'],
        'Solano County' => ['Benicia','Vallejo','Suisun City','Fairfield'],
        'Napa County' => ['American Canyon'],
        'Marin County' => ['Sausalito','Mill Valley','Belvedere','Tiburon','Belvedere Tiburon','Corte Madera','Larkspur','San Rafael','Ross','San Anselmo','Fairfax','Novato'],
    ];

    public static function counties(): array
    {
        return array_keys(self::COUNTIES);
    }

    public static function apply(Builder $query, string $county): Builder
    {
        $cities = self::COUNTIES[$county] ?? [];
        if ($cities === []) return $query->whereRaw('1 = 0');

        return $query->whereIn(
            DB::raw('LOWER(TRIM(city))'),
            array_map(fn (string $city): string => mb_strtolower($city), $cities),
        );
    }
}
