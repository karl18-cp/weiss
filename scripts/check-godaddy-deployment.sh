#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")/.."

echo "Checking PHP version and required extensions..."
php -r 'if (version_compare(PHP_VERSION, "8.3.0", "<")) { fwrite(STDERR, "PHP 8.3 or newer is required.\n"); exit(1); }'
composer check-platform-reqs --no-dev

echo "Checking application configuration..."
php artisan optimize:clear
php artisan about --only=environment,drivers

echo "Checking frontend types and creating production assets..."
npm run types:check
npm run build

test -f public/build/manifest.json

echo "Running automated tests..."
php artisan test

echo "GoDaddy pre-deployment checks passed."
