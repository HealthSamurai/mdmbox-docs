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

Bearer authentication supports Aidbox access tokens and the `TokenIntrospector` resources configured in Aidbox. MDMbox does not evaluate `AccessPolicy`; every successfully authenticated credential has the same access to protected MDMbox endpoints. See [Authentication](authentication.md) for configuration and request examples.

| Variable | Description | Default |
| --- | --- | --- |
| `MDMBOX_AUTH_ENABLED` | Enable authentication for API endpoints and the Admin UI. Accepted values: `true` or `false`. | `true` |
| `MDMBOX_ADMIN_ID` | Admin `User` id to bootstrap for browser login. Must be set together with `MDMBOX_ADMIN_PASSWORD`. | unset |
| `MDMBOX_ADMIN_PASSWORD` | Password for the bootstrapped admin `User`. Must be set together with `MDMBOX_ADMIN_ID`. | unset |
| `MDMBOX_API_CLIENT_ID` | API `Client` id to bootstrap for Basic auth. Must be set together with `MDMBOX_API_CLIENT_SECRET`. | unset |
| `MDMBOX_API_CLIENT_SECRET` | Secret for the bootstrapped API `Client`. Must be set together with `MDMBOX_API_CLIENT_ID`. | unset |

## Audit

MDM operation auditing is automatic and has no separate enable/disable setting. Aidbox's native audit settings do not control these events, and its repository URL does not export them. See [Audit](audit.md) for covered operations, persistence guarantees, and storage limitations.

## Match operation

| Variable | Description | Default |
| --- | --- | --- |
| `MDMBOX_MATCH_DEFAULT_COUNT` | Default maximum number of `$match` results when the request omits `count`. | `10` |
| `MDMBOX_TEFCA_MODE` | Enable R4 TEFCA `$match` behavior. When enabled, potential-match responses (`onlyCertainMatches=false`) return no more than 100 entries. | unset (`false`) |
| `MDMBOX_DEFAULT_FHIR_RELEASE` | FHIR release used by unversioned `/api/fhir/:resource/...` routes. Accepted values: `4.0.1` and `6.0.0`. | `6.0.0` |

## Merge and unmerge algorithms

Built-ins are enabled by default. Set `MDMBOX_BUILT_IN_ALGORITHMS` to a comma-separated allowlist such as `simple,strict`, or an empty value to disable all built-ins. IDs are case-sensitive; unknown IDs prevent startup. Restart after changing the setting.

This list does not restrict Git or database scripts. The default algorithm IDs remain `simple` for merge and `restore` for unmerge. An unavailable default returns HTTP 400 unless a custom script supplies that ID.

| Variable | Description | Default |
| --- | --- | --- |
| `MDMBOX_BUILT_IN_ALGORITHMS` | Enabled built-ins: `simple`, `restore`, `strict` | unset (all enabled) |

Manage scripts and Git sources through **Algorithms** in the Admin UI. Runtime sources can be added and synchronized without restarting. The variables below configure a separate, reserved `environment` source:

| Variable | Description | Default |
| --- | --- | --- |
| `MDMBOX_ALGORITHM_GIT_URL` | HTTPS or SSH repository URL, or an absolute `file:///` URI. Do not put passwords or tokens in the URL. | unset (no environment source; runtime sources remain available) |
| `MDMBOX_ALGORITHM_GIT_REF` | `HEAD`, full branch ref such as `refs/heads/main`, full tag ref such as `refs/tags/v1`, or a 40-character commit SHA. A remote must allow fetching the selected commit. | `HEAD` |
| `MDMBOX_ALGORITHM_GIT_USERNAME` | HTTPS authentication username; use the username required by the Git host for your token type. | `git` |
| `MDMBOX_ALGORITHM_GIT_TOKEN_FILE` | Absolute path to a mounted read-only secret containing the HTTPS token or password. | unset |
| `MDMBOX_ALGORITHM_GIT_CA_FILE` | Absolute path to an optional PEM CA bundle for a private HTTPS Git server. Certificate verification remains enabled. | system CA trust |

Setting a Git environment option requires a valid URL. This source refreshes at startup; invalid configuration, unavailable revisions, authentication errors, or invalid scripts prevent startup. Runtime sources retain their last published scripts without fetching on startup.

See [Algorithm management](algorithms.md) for setup, private access, precedence, and synchronization.

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

Both bulk matching jobs and [continuous matching processes](continuous-matching.md) use the bulk pool. Each job or process reserves one connection per worker plus one for its coordinator, including during preparation. A Start that exceeds the bulk pool capacity is refused with HTTP 409. Include both pools, other applications and all replicas when sizing PostgreSQL's connection limit. Continuous matching requires a single MDMbox replica with the [documented upgrade strategy](continuous-matching.md#deployment-and-upgrades).

## HTTP Server

| Variable           | Description | Default |
| ------------------ | ----------- | ------- |
| `MDMBOX_HTTP_PORT` | HTTP port | 3000 |
| `MDMBOX_HTTP_HOST` | Bind address | `0.0.0.0` in the Docker image; `127.0.0.1` otherwise |

## Related Pages

- [Getting started](getting-started.md)
- [Authentication](authentication.md)
- [Find duplicates: $match](match-operation.md)
