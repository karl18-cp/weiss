# GoDaddy deployment guide

This project is a Laravel 13 application with a React/Vite frontend. It requires
Linux Web Hosting with cPanel (or a VPS), PHP 8.3 or newer, MySQL/MariaDB, and
Apache `mod_rewrite`. It is not a static HTML site and should not be uploaded to
GoDaddy Website Builder or Managed WordPress hosting.

## 1. Prepare the hosting account

1. In GoDaddy, open **Web Hosting > Manage > Settings** and select PHP 8.3 or
   PHP 8.4. Do not select PHP 8.2 or older.
2. Enable SSH access from the same settings area.
3. In cPanel, create a MySQL database and database user. Grant the user all
   privileges on that database and save the database hostname and credentials.
4. Enable the PHP extensions Laravel needs: Ctype, cURL, DOM, Fileinfo, Filter,
   Hash, Mbstring, OpenSSL, PCRE, PDO, PDO MySQL, Session, Tokenizer, and XML.

## 2. Use a secure document root

The web document root must point to this project's `public` directory. Never put
`.env`, `app`, `bootstrap`, `config`, `database`, `resources`, `routes`,
`storage`, or `vendor` inside a publicly browsable directory.

The recommended cPanel layout is:

```text
/home/CPANEL_USER/weiss/          Laravel project
/home/CPANEL_USER/weiss/public/   domain document root
```

For an addon domain or subdomain, set its **Document Root** to
`/home/CPANEL_USER/weiss/public` in cPanel's Domains section.

GoDaddy normally fixes a primary domain's root at `public_html`. In that case,
ask GoDaddy support to point the domain to the project's `public` directory, use
an addon domain with a configurable document root, or use a VPS. Do not move the
entire Laravel project into `public_html`; doing so can expose credentials and
source code. If the account cannot direct the domain to `public`, it is not a
safe Laravel hosting configuration.

## 3. Prepare the application locally

Run the included check before every upload:

```bash
bash scripts/check-godaddy-deployment.sh
```

The command builds `public/build`, checks TypeScript and PHP requirements, and
runs the test suite. The server does not need Node.js when the compiled
`public/build` directory is uploaded.

For a production Composer install, run:

```bash
composer install --no-dev --prefer-dist --optimize-autoloader
```

Upload the project, including `vendor` and `public/build`, but excluding `.env`,
`node_modules`, tests, local logs, and editor files. If Composer is available
over GoDaddy SSH, uploading `vendor` is optional; run the production Composer
command on the server instead.

## 4. Configure production

On the server, copy `.env.godaddy.example` to `.env`. Replace every placeholder
with the real domain, database, and mail settings. Never upload a local `.env`
or commit the production `.env` to source control.

Then connect through SSH, enter the application directory, and run:

```bash
php artisan key:generate --force
php artisan migrate --force
php artisan storage:link
php artisan optimize
```

Run `key:generate` only during the first deployment. Changing `APP_KEY` later
will invalidate encrypted cookies and any encrypted application data.

Make these directories writable by the hosting account:

```text
storage/
bootstrap/cache/
```

Use directory permission `775` when required by the server. Do not use `777`.

## 5. HTTPS and scheduled tasks

Enable an SSL certificate for the domain before using the production settings.
The production template enables secure session cookies, so sign-in requires
HTTPS.

If scheduled Laravel tasks are added later, create this cPanel cron job:

```text
* * * * * cd /home/CPANEL_USER/weiss && php artisan schedule:run >> /dev/null 2>&1
```

The production template uses `QUEUE_CONNECTION=sync`, which is reliable on
shared hosting without a continuously running queue worker. A VPS can use a
supervised database or Redis queue instead.

## 6. Post-deployment verification

Check all of the following after launch:

- `/up` returns a successful response.
- The login and registration pages load without a Vite manifest error.
- A user can register, sign in, sign out, and reset a password.
- `storage/logs/laravel.log` contains no production errors.
- `.env`, `composer.json`, and application directories cannot be opened through
  the public domain.

For later code updates, upload the changed files and compiled `public/build`,
then run:

```bash
php artisan migrate --force
php artisan optimize
```
