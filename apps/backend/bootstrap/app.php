<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withCommands([
        \App\Console\Commands\RetryWorkerTasksCommand::class,
        \App\Console\Commands\ResetDailyQuotasCommand::class,
        \App\Console\Commands\OpenClawSmokeCommand::class,
    ])
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'tenant' => \App\Http\Middleware\TenantMiddleware::class,
            'worker.signature' => \App\Http\Middleware\VerifyWorkerSignature::class,
            'tenant.admin' => \App\Http\Middleware\RequireTenantAdmin::class,
            'super.admin' => \App\Http\Middleware\RequireSuperAdmin::class,
            'subscription.enforce' => \App\Http\Middleware\EnforceSubscription::class,
            'cors' => \App\Http\Middleware\CorsMiddleware::class,
        ]);

        // Apply tenant resolution and CORS to every /api/* request
        $middleware->api(prepend: [
            \App\Http\Middleware\CorsMiddleware::class,
            \App\Http\Middleware\TenantMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
