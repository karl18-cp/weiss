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
                new ExtensionMimeTypeDetector(),
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
