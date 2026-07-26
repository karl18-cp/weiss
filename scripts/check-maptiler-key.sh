#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")/.."

key="$(
    sed -n 's/^MAPTILER_BROWSER_KEY=//p' .env |
        tail -n 1 |
        tr -d '\r"'
)"

if [[ -z "$key" ]]; then
    echo "MAPTILER_BROWSER_KEY is missing."
    exit 1
fi

style_url="https://api.maptiler.com/maps/streets-v2/style.json?key=${key}"

printf 'Production origin: '
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' \
    --header 'Origin: https://weiss.brighthorizon-cg.com' \
    "$style_url"

printf 'Production referer: '
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' \
    --header 'Referer: https://weiss.brighthorizon-cg.com/lead-workflow/booking-board' \
    "$style_url"

printf 'Unknown origin: '
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' \
    "$style_url"

style="$(
    curl --silent --show-error \
        --header 'Origin: https://weiss.brighthorizon-cg.com' \
        "$style_url"
)"

echo 'Style endpoints:'
printf '%s' "$style" |
    grep -oE 'https:[^"]+' |
    sed -E 's/key=[^&"]+/key=[redacted]/g' |
    sort -u

tiles_url="https://api.maptiler.com/tiles/v3/tiles.json?key=${key}"
printf 'Vector source: '
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' \
    --header 'Origin: https://weiss.brighthorizon-cg.com' \
    "$tiles_url"

printf 'Vector tile: '
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' \
    --header 'Origin: https://weiss.brighthorizon-cg.com' \
    "https://api.maptiler.com/tiles/v3/0/0/0.pbf?key=${key}"
