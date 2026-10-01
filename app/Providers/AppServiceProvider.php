<?php

namespace App\Providers;

use App\Models\Company;
use App\Models\Lead;
use App\Models\Project;
use App\Models\ProjectAccountingTransaction;
use App\Models\ProjectDocument;
use App\Models\ProjectInvoice;
use App\Models\ProjectPaymentCheck;
use App\Models\ProjectSale;
use App\Models\Proposal;
use App\Models\RingCentralCall;
use App\Models\ScheduledPayment;
use App\Observers\ProjectActivityObserver;
use App\Support\ManagerCompanyAccess;
use Carbon\CarbonImmutable;
use Illuminate\Filesystem\LocalFilesystemAdapter as LaravelLocalFilesystemAdapter;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use League\Flysystem\Filesystem as Flysystem;
use League\Flysystem\Local\LocalFilesystemAdapter as FlysystemLocalAdapter;
use League\Flysystem\UnixVisibility\PortableVisibilityConverter;
use League\MimeTypeDetection\ExtensionMimeTypeDetector;

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
        $this->applyManagerCompanyScopes();

        Storage::extend('portable-local', function ($app, array $config): LaravelLocalFilesystemAdapter {
            $visibility = PortableVisibilityConverter::fromArray(
                $config['permissions'] ?? [],
                $config['directory_visibility'] ?? $config['visibility'] ?? 'private',
            );
            $links = ($config['links'] ?? null) === 'skip'
                ? FlysystemLocalAdapter::SKIP_LINKS
                : FlysystemLocalAdapter::DISALLOW_LINKS;
            $adapter = new FlysystemLocalAdapter(
                $config['root'],
                $visibility,
                $config['lock'] ?? LOCK_EX,
                $links,
                new ExtensionMimeTypeDetector,
            );

            return (new LaravelLocalFilesystemAdapter(
                new Flysystem($adapter, $config),
                $adapter,
                $config,
            ))->diskName($config['name'] ?? 'local')->shouldServeSignedUrls(
                $config['serve'] ?? false,
                fn () => $app['url'],
            );
        });

        Vite::useHotFile(storage_path('vite.hot'));

        Project::observe(ProjectActivityObserver::class);
        ProjectSale::observe(ProjectActivityObserver::class);
        ProjectInvoice::observe(ProjectActivityObserver::class);
        ProjectAccountingTransaction::observe(ProjectActivityObserver::class);
        ProjectDocument::observe(ProjectActivityObserver::class);
        ScheduledPayment::observe(ProjectActivityObserver::class);

        $this->configureDefaults();
    }

    private function applyManagerCompanyScopes(): void
    {
        $companyScope = function ($query): void {
            $ids = ManagerCompanyAccess::companyIds();
            if ($ids !== null) {
                $query->whereIn($query->getModel()->qualifyColumn('com_id'), $ids);
            }
        };
        Company::addGlobalScope('manager_companies', $companyScope);

        Lead::addGlobalScope('manager_companies', function ($query): void {
            $ids = ManagerCompanyAccess::companyIds();
            if ($ids !== null) {
                $query->whereIn($query->getModel()->qualifyColumn('company_id'), $ids);
            }
        });

        Project::addGlobalScope('manager_companies', function ($query): void {
            $ids = ManagerCompanyAccess::companyIds();
            if ($ids === null) {
                return;
            }

            $table = $query->getModel()->getTable();
            $query->where(function ($query) use ($ids, $table): void {
                $query->where(function ($query) use ($ids, $table): void {
                    $query->whereNotNull("{$table}.lead_id")
                        ->whereHas('lead', fn ($lead) => $lead->whereIn('leads.company_id', $ids));
                })->orWhere(function ($query) use ($ids, $table): void {
                    $query->whereNull("{$table}.lead_id")
                        ->whereIn("{$table}.company_id", $ids);
                });
            });
        });

        foreach ([
            ProjectInvoice::class,
            ProjectAccountingTransaction::class,
            ProjectDocument::class,
            ProjectPaymentCheck::class,
            ProjectSale::class,
            ScheduledPayment::class,
        ] as $model) {
            $model::addGlobalScope('manager_companies', function ($query): void {
                if (ManagerCompanyAccess::companyIds() !== null) {
                    $query->whereHas('project');
                }
            });
        }

        Proposal::addGlobalScope('manager_companies', function ($query): void {
            if (ManagerCompanyAccess::companyIds() === null) {
                return;
            }

            $table = $query->getModel()->getTable();
            $query->where(function ($query) use ($table): void {
                $query->where(function ($query) use ($table): void {
                    $query->whereNotNull("{$table}.project_id")->whereHas('project');
                })->orWhere(function ($query) use ($table): void {
                    $query->whereNull("{$table}.project_id")->whereHas('lead');
                });
            });
        });

        RingCentralCall::addGlobalScope('manager_companies', function ($query): void {
            if (ManagerCompanyAccess::companyIds() === null) {
                return;
            }

            $table = $query->getModel()->getTable();
            $query->where(function ($query) use ($table): void {
                $query->whereNull("{$table}.lead_id")->orWhereHas('lead');
            });
        });
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
