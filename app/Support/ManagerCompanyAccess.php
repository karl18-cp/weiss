<?php

namespace App\Support;

use App\Models\Account;
use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class ManagerCompanyAccess
{
    /** @return list<int>|null Null means the account is not company restricted. */
    public static function companyIds(?Account $account = null): ?array
    {
        $account ??= auth()->user();
        if (! $account || $account->role !== 'manager') {
            return null;
        }

        $request = app()->bound('request') ? request() : null;
        $cacheKey = '_manager_company_ids_'.$account->getKey();
        if ($request?->attributes->has($cacheKey)) {
            return $request->attributes->get($cacheKey);
        }

        $manager = DB::table('managers')
            ->where('account_id', $account->getKey())
            ->first(['manager_id', 'company_id']);
        $ids = $manager
            ? DB::table('company_manager')
                ->where('manager_id', $manager->manager_id)
                ->pluck('company_id')
                ->map(fn ($id): int => (int) $id)
                ->all()
            : [];

        // Keep older manager accounts restricted by their legacy company field
        // until their pivot assignments have been saved through the manager form.
        if ($ids === [] && filled($manager?->company_id)) {
            $ids = [(int) $manager->company_id];
        }

        $ids = array_values(array_unique($ids));
        $request?->attributes->set($cacheKey, $ids);

        return $ids;
    }

    /**
     * @template TModel of \Illuminate\Database\Eloquent\Model
     *
     * @param  EloquentBuilder<TModel>|QueryBuilder  $query
     */
    public static function scopeColumn(EloquentBuilder|QueryBuilder $query, string $column, ?Account $account = null): void
    {
        $ids = self::companyIds($account);
        if ($ids !== null) {
            $query->whereIn($column, $ids);
        }
    }

    public static function assertRequestCompanies(Request $request): void
    {
        $ids = self::companyIds($request->user());
        if ($ids === null) {
            return;
        }

        $requested = collect([
            $request->input('company_id'),
            ...((array) $request->input('company_ids', [])),
        ])->filter(fn ($id): bool => filled($id))
            ->map(fn ($id): int => (int) $id)
            ->unique();

        abort_if($requested->contains(fn (int $id): bool => ! in_array($id, $ids, true)), 403,
            'You can only use companies assigned to your manager account.');
    }
}
