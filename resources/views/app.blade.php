<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" style="color-scheme: light">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        {{-- The CRM intentionally uses one tested light appearance. --}}
        <script>
            (function() {
                document.documentElement.classList.remove('dark');
                localStorage.removeItem('appearance');
                document.cookie = 'appearance=light; path=/; max-age=31536000; SameSite=Lax';
            })();
        </script>

        {{-- Inline style to set the HTML background color based on our theme in app.css --}}
        <style>
            html {
                background-color: oklch(1 0 0);
            }

            /* Keep third-party widget failures from covering the CRM. */
            #rc-widget-adapter-frame {
                max-width: min(24rem, calc(100vw - 2rem)) !important;
                max-height: min(42rem, calc(100svh - 2rem)) !important;
                border-radius: 0.75rem !important;
                box-shadow: 0 1rem 3rem rgb(15 23 42 / 24%) !important;
            }
        </style>

        <link rel="icon" href="/favicon.ico" sizes="any">
        <link rel="icon" href="/favicon.svg" type="image/svg+xml">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">
        <link rel="manifest" href="/manifest.webmanifest">
        <meta name="theme-color" content="#ffffff">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="default">
        <meta name="apple-mobile-web-app-title" content="Weiss Sales">

        @fonts

        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        <x-inertia::head>
            <title>{{ config('app.name', 'Laravel') }}</title>
        </x-inertia::head>
    </head>
    <body class="font-sans antialiased">
        <x-inertia::app />

        @auth
            @if (config('services.ringcentral.embeddable_client_id'))
                <script
                    src="https://apps.ringcentral.com/integration/ringcentral-embeddable/latest/adapter.js?clientId={{ urlencode(config('services.ringcentral.embeddable_client_id')) }}"
                    async
                ></script>
            @endif
        @endauth
    </body>
</html>
