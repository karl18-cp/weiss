#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec php "$PROJECT_ROOT/artisan" calltools:sync-reporting --pages=35
