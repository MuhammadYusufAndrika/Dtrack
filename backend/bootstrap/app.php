<?php

use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
<<<<<<< HEAD
        // Token-based API (Bearer di localStorage), bukan cookie SPA —
        // jangan pakai statefulApi() agar POST /api/* tidak kena 419 CSRF.
        $middleware->trustProxies(at: '*');
=======
        $middleware->trustProxies(at: '*');

        $middleware->statefulApi();
>>>>>>> dcde8dba25bc5f15138b2ccf493af4ba9ebdad73
        $middleware->web(append: [
            HandleInertiaRequests::class,
        ]);
        $middleware->alias([
            'ai.apikey' => \App\Http\Middleware\CheckAiApiKey::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
