<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Log;

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
        if ((bool) config('services.worker.auto_submit_enabled', false)) {
            Log::warning('WORKER_AUTO_SUBMIT_ENABLED is true. Ensure tenant-level policy, audit logging, and review safeguards are in place.');
        }
    }
}
