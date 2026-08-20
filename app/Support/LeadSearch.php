<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;

final class LeadSearch
{
    public static function orWhereFullAddress(Builder $query, string $search, string $prefix = ''): Builder
    {
        $needle = mb_strtolower(trim((string) preg_replace('/[\s,.]+/', ' ', $search)));
        if ($needle === '') {
            return $query;
        }

        $column = static fn (string $name): string => $prefix.$name;
        $driver = $query->getConnection()->getDriverName();
        $combined = $driver === 'sqlite'
            ? "LOWER(COALESCE({$column('address')}, '') || ' ' || COALESCE({$column('city')}, '') || ' ' || COALESCE({$column('state')}, '') || ' ' || COALESCE({$column('zip_code')}, ''))"
            : "LOWER(CONCAT_WS(' ', {$column('address')}, {$column('city')}, {$column('state')}, {$column('zip_code')}))";
        $expression = "REPLACE(REPLACE({$combined}, ',', ''), '.', '')";

        return $query->orWhereRaw("{$expression} LIKE ?", ['%'.$needle.'%']);
    }
}
