---
description: Environment variables and runtime configuration for MDMbox.
---

# Configuration reference

MDMbox is configured through environment variables.

## License

MDMbox requires an active license for API access. There are two ways to activate it:

1. **Environment variable.** Sign in to the [Aidbox portal](https://aidbox.app/ui/portal), open the MDMbox project, copy the license JWT, and pass it to the MDMbox container as `MDMBOX_LICENSE`. Recommended for production and CI.
2. **Browser activation.** Leave `MDMBOX_LICENSE` unset and start MDMbox. Open `http://localhost:3000`, click **Continue with Aidbox account**, sign in to the portal — a development MDMbox license is generated and stored in the database automatically. Useful for local development.

MDMbox reuses a browser-issued license when its container is restarted or recreated, as long as the database is retained.

| Variable | Description | Required |
| --- | --- | --- |
| `MDMBOX_LICENSE` | License JWT copied from the Aidbox portal | No — falls back to browser activation |

## Authentication

Authentication is enabled by default. When enabled, MDMbox protects both API endpoints and the Admin UI:

- API endpoints require a valid `Authorization` header.
- The Admin UI uses browser session authentication and redirects unauthenticated users to `/login`.
- Health checks, Swagger UI, and the OpenAPI specification remain public.

For API Bearer authentication, MDMbox uses Aidbox's authentication pipeline and the `TokenIntrospector` resources configured in Aidbox. MDMbox does not evaluate `AccessPolicy`; every successfully authenticated credential has the same access to protected MDMbox endpoints. See [Authentication](authentication.md) for configuration and request examples.

| Variable | Description | Default |
| --- | --- | --- |
| `MDMBOX_AUTH_ENABLED` | Enable authentication for API endpoints and the Admin UI. Accepted values: `true` or `false`. | `true` |
| `MDMBOX_ADMIN_ID` | Admin `User` id to bootstrap for browser login. Must be set together with `MDMBOX_ADMIN_PASSWORD`. | unset |
| `MDMBOX_ADMIN_PASSWORD` | Password for the bootstrapped admin `User`. Must be set together with `MDMBOX_ADMIN_ID`. | unset |
| `MDMBOX_API_CLIENT_ID` | API `Client` id to bootstrap for Basic auth. Must be set together with `MDMBOX_API_CLIENT_SECRET`. | unset |
| `MDMBOX_API_CLIENT_SECRET` | Secret for the bootstrapped API `Client`. Must be set together with `MDMBOX_API_CLIENT_ID`. | unset |

## Match operation

| Variable | Description | Default |
| --- | --- | --- |
| `MDMBOX_MATCH_DEFAULT_COUNT` | Default maximum number of `$match` results when the request omits `count`. | `10` |
| `MDMBOX_TEFCA_MODE` | Enable R4 TEFCA `$match` behavior. When enabled, potential-match responses (`onlyCertainMatches=false`) return no more than 100 entries. | unset (`false`) |
| `MDMBOX_DEFAULT_FHIR_RELEASE` | FHIR release used by unversioned `/api/fhir/:resource/...` routes. Accepted values: `4.0.1` and `6.0.0`. | `6.0.0` |

## Merge and unmerge algorithms

`MDMBOX_BUILT_IN_ALGORITHMS` controls built-in algorithms only. Unset means all
are enabled (`simple`, `restore`, `strict`). An empty or whitespace-only value
disables all built-ins. Otherwise provide a comma-separated, case-sensitive
allowlist, for example `simple,strict`. Whitespace and duplicates are ignored;
unknown ids prevent startup. Restart after changing the environment.

Git and database algorithms are not restricted by this list. Operation defaults
remain `simple` for merge and `restore` for unmerge: if that id is unavailable,
the request returns HTTP 400, not another algorithm. A custom Git or database
algorithm with the same id may still serve it. The merge database id `simple`
remains reserved.

| Variable | Description | Default |
| --- | --- | --- |
| `MDMBOX_BUILT_IN_ALGORITHMS` | Allowed built-in ids, separated by commas. Empty disables all. Example: `simple,strict`. | unset (all built-ins enabled) |

Git storage is optional and read-only. Configure a small, administrator-controlled
repository containing `merge/<id>.js` and/or `unmerge/<id>.js`. Add runtime sources
and manually synchronize revisions through **Algorithms → Configuration**;
no restart is needed. The variables below configure a separate, reserved
`environment` source that is refreshed at startup and can also be synchronized
from the UI. See
[Git algorithm storage](merge-operation.md#git-algorithm-storage) for layout,
private access, limits, and precedence.

| Variable | Description | Default |
| --- | --- | --- |
| `MDMBOX_ALGORITHM_GIT_URL` | HTTPS or SSH repository URL, or an absolute `file:///` URI. Do not put passwords or tokens in the URL. | unset (no environment source; runtime sources remain available) |
| `MDMBOX_ALGORITHM_GIT_REF` | `HEAD`, full branch ref such as `refs/heads/main`, full tag ref such as `refs/tags/v1`, or a 40-character commit SHA. A remote must allow fetching the selected commit. | `HEAD` |
| `MDMBOX_ALGORITHM_GIT_USERNAME` | HTTPS authentication username; use the username required by the Git host for your token type. | `git` |
| `MDMBOX_ALGORITHM_GIT_TOKEN_FILE` | Absolute path to a mounted read-only secret containing the HTTPS token or password. | unset |
| `MDMBOX_ALGORITHM_GIT_CA_FILE` | Absolute path to an optional PEM CA bundle for a private HTTPS Git server. Certificate verification remains enabled. | system CA trust |

Setting any Git environment option requires a valid repository URL. For the
environment source, invalid configuration, authentication failure, a missing
revision, or invalid scripts prevent startup; MDMbox does not silently substitute
another revision or a stale catalog. Runtime sources and their last published
scripts are persisted in the shared database and do not require a startup fetch.
Use consistent environment settings across instances sharing that database.

Open **Algorithms → Configuration** in the Admin UI to inspect the effective
built-in policy, repository URL, requested ref, and loaded commit. Credential
and CA files are shown only as configured/not configured; HTTPS authentication
usernames, tokens, and stored secret-file locations are hidden. Viewing the page
does not fetch Git. Add or edit a runtime source, save its configuration, then
use **Sync** to publish both operation catalogs atomically. A failed sync keeps
the last good scripts. Change deployment environment variables and restart only
to change built-in availability or the reserved environment source configuration.
Database merge and unmerge scripts are managed on their own tabs and do not
require a restart. See the [source-management workflow](merge-operation.md#managing-algorithms-in-the-admin-ui)
for concurrency limits, credential-file requirements, and removal behavior.

## Shared database configuration

Aidbox and MDMbox run as separate applications against the same PostgreSQL database. MDMbox accepts the standard Aidbox `BOX_DB_*` environment variables so the database connection configuration can be shared between both application environments. Pass the same values to Aidbox and MDMbox.

| Variable          | Description                     | Required |
| ----------------- | ------------------------------- | -------- |
| `BOX_DB_HOST`     | PostgreSQL host                 | Yes      |
| `BOX_DB_PORT`     | PostgreSQL port (default: 5432) | No       |
| `BOX_DB_DATABASE` | Database name                   | Yes      |
| `BOX_DB_USER`     | Database user                   | Yes      |
| `BOX_DB_PASSWORD` | Database password               | Yes      |

## MDMbox connection pools

The database connection settings are shared, but connection pool sizing is application-specific. MDMbox has a main pool for API and admin traffic and a separate bulk pool for matching workers. These variables do not change the Aidbox application's pool size.

| Variable                  | Description              | Default |
| ------------------------- | ------------------------ | ------- |
| `MDMBOX_DB_MAX_POOL_SIZE` | Maximum main pool connections | 10 |
| `MDMBOX_DB_MIN_IDLE` | Minimum idle main pool connections | 1 |
| `MDMBOX_BULK_DB_MAX_POOL_SIZE` | Maximum bulk pool connections | 12 |
| `MDMBOX_BULK_DB_MIN_IDLE` | Minimum idle bulk pool connections | 0 |
| `MDMBOX_BULK_DB_IDLE_TIMEOUT_MS` | Time before unused bulk connections can be released, in milliseconds | 60000 |

Both bulk matching jobs and [continuous matching processes](bulk-matching-process.md) use the bulk pool. A continuous process reserves one connection per range worker plus one for its coordinator, including while its projection is being built. A Start that exceeds the bulk pool capacity is refused with HTTP 409. Finishing an interrupted pause at startup uses the main pool without reserving bulk connections. Include both pools, other applications and all replicas when sizing PostgreSQL's connection limit. Continuous matching requires a single MDMbox replica with the [documented upgrade strategy](bulk-matching-process.md#deployment-and-upgrades).

## HTTP Server

| Variable           | Description | Default |
| ------------------ | ----------- | ------- |
| `MDMBOX_HTTP_PORT` | HTTP port   | 3000    |

## Related Pages

- [Getting started](getting-started.md)
- [Authentication](authentication.md)
- [Find duplicates: $match](match-operation.md)
