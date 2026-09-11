<?php

namespace App\Providers;

use App\Models\Project;
use App\Models\ProjectAccountingTransaction;
use App\Models\ProjectDocument;
use App\Models\ProjectInvoice;
use App\Models\ProjectSale;
use App\Models\ScheduledPayment;
use App\Observers\ProjectActivityObserver;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Vite::useHotFile(storage_path('vite.hot'));

        Project::observe(ProjectActivityObserver::class);
        ProjectSale::observe(ProjectActivityObserver::class);
        ProjectInvoice::observe(ProjectActivityObserver::class);
        ProjectAccountingTransaction::observe(ProjectActivityObserver::class);
        ProjectDocument::observe(ProjectActivityObserver::class);
        ScheduledPayment::observe(ProjectActivityObserver::class);

        $this->configureDefaults();
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
