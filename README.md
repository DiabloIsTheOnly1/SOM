# SOM
Technical Assesment for a sales order monitoring system by Harrisons Sabah Sdn Bhd.

## Install and run locally

Requires PHP 8.3+, Composer, and standard Laravel extensions including cURL, mbstring, DOM, XML, and OpenSSL. No database, npm, or frontend build is required.

```powershell
composer install
Copy-Item .env.example .env
php artisan key:generate
php artisan serve
```

Open http://127.0.0.1:8000. On Linux/macOS, use `cp .env.example .env` instead of `Copy-Item`. After cloning, create the writable directories `bootstrap/cache`, `storage/framework/views`, `storage/framework/sessions`, `storage/framework/cache/data`, and `storage/logs` before installing dependencies if they do not exist. Docker creates them automatically.

If local PHP reports `cURL error 60`, configure its trusted CA bundle in php.ini or set `ASSESSMENT_CA_BUNDLE` in `.env` to a valid local bundle path. Leave that variable unset on Render; the container uses the system trust store. TLS verification remains enabled.

## Deploy on Render Free

1. Push the source, including `Dockerfile`, `.dockerignore`, and `docker-entrypoint.sh`, to GitHub.
2. In Render, choose **New → Web Service**, then connect this repository.
3. Select **Docker** as the language/runtime and **Free** as the instance type. Use the repository root and `./Dockerfile`. Leave Docker Command blank; the image supplies its startup command.
4. Generate a dedicated deployment key locally:

   ```powershell
   php artisan key:generate --show
   ```

   Copy the entire `base64:...` output into Render's `APP_KEY` environment variable. This command displays a new key without changing the local `.env`. Keep the key stable across redeploys and do not commit it.

5. Set these environment variables in Render:

   | Variable | Value |
   | --- | --- |
   | `APP_KEY` | The generated `base64:...` value |
   | `ASSESSMENT_API_KEY` | `hssb-assessment-mock-2026` |

   The image already sets `APP_ENV=production`, `APP_DEBUG=false`, `LOG_CHANNEL=stderr`, `SESSION_DRIVER=file`, `CACHE_STORE=file`, and `QUEUE_CONNECTION=sync`. The startup script derives `APP_URL` and `ASSET_URL` from `RENDER_EXTERNAL_URL`, ensuring styles and scripts use HTTPS. If you explicitly set either URL, use the full HTTPS service URL without a trailing slash. Do not copy the local `.env` or its Windows CA bundle path into Render.

6. Set **Health Check Path** to `/up`, then deploy. No database, migration, disk, pre-deploy command, or separate build/start command is required.
7. After Render reports Live, open the public URL and check `/up`, `/api/orders?pageSize=1`, and `/api/orders/meta`. Then verify desktop/mobile layout, searching, combined filters, sorting, pagination, and empty results in a browser.

The container uses Apache with its document root restricted to `public/`. It installs production dependencies from `composer.lock`, excludes local secrets and runtime files, creates writable runtime directories, listens on Render's `PORT`, and builds Laravel caches at startup using runtime environment variables.

Render Free services sleep after 15 minutes without requests and take about a minute to resume. Runtime files are ephemeral, which is acceptable here because orders are fetched from the immutable REST API and never stored locally. Sessions and caches may reset after a restart. See [Render Free documentation](https://render.com/docs/free) and [Docker deployment documentation](https://render.com/docs/docker).

## Architecture and API

One controller validates and forwards browser requests to the fixed assessment REST API using an authentication header. One Blade view plus plain CSS and JavaScript render the dashboard. The browser calls same-origin `/api/orders` and `/api/orders/meta`; all upstream calls use GET and no order data is stored locally.

Search, branch/status filters, pagination, and sorting run upstream. Metadata supplies filter options. The API summary remains global when filters are applied; the listing count reflects the selected filters. Completed orders combine invoiced and delivered counts. The UI displays amounts in MYR and order dates in Asia/Kuala_Lumpur. Search is debounced and earlier requests are cancelled. Loading, empty, and recoverable error states are included.

## Testing and AI disclosure

```powershell
composer test
```

Eight automated tests cover rendering, authenticated GET forwarding, query validation, metadata, upstream errors, malformed responses, and blocked writes. Optional JavaScript syntax check: `node --check public/app.js`.

OpenAI Codex assisted with implementation, documentation, API inspection, and tests. Earlier local verification passed 8 tests with 28 assertions and live HTTP checks for searching, filtering, sorting, pagination, and empty results. Public deployment and visual browser testing must be verified after deployment. The Docker image has not been built locally because a working Docker runtime was unavailable.
