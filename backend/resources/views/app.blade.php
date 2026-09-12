<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="dark">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title inertia>{{ config('app.name', 'FleetVision AI') }}</title>
    <meta name="description" content="FleetVision AI — real-time fleet tracking & driver monitoring.">
    <meta name="theme-color" content="#0a0e16">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="FleetVision">
    <link rel="manifest" href="/manifest.webmanifest">
    <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png">
    <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png">
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.jsx'])
    @inertiaHead
</head>
<body class="antialiased bg-dark-950 text-dark-100">
    @inertia
    <script>
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').catch(() => {});
            });
        }
    </script>
</html>
