---
description: Environment variables and runtime configuration for MDMbox.
---

# Configuration reference

MDMbox is configured through environment variables.

## License

MDMbox requires an active license. Choose an activation method:

1. **Production and CI:** obtain an MDMbox license from the [portal](https://aidbox.app/ui/portal) and set `MDMBOX_LICENSE` in the MDMbox environment.
2. **Local development:** start MDMbox, open `http://localhost:3000`, and activate it with your portal account. Operations are available immediately after activation. The license is saved in the database and reused on restart.

An expired or inactive license restricts requests with HTTP 403. If the license portal is temporarily unavailable, MDMbox allows a 24-hour grace period. `/healthz` remains available for liveness checks.

For Aidbox activation, see [Aidbox licensing](https://www.health-samurai.io/docs/aidbox/overview/aidbox-user-portal/licenses).

| Variable | Description | Required |
| --- | --- | --- |
| `MDMBOX_LICENSE` | MDMbox license JWT | For unattended activation |

## Authentication

Authentication is enabled by default. API requests use an `Authorization` header; the Admin UI uses browser login. Every authenticated credential has full access to protected MDMbox endpoints. See [Authentication](authentication.md) for setup and examples.

| Variable | Description | Default |
| --- | --- | --- |
| `MDMBOX_AUTH_ENABLED` | Enable authentication for API endpoints and the Admin UI. Accepted values: `true` or `false`. | `true` |
| `MDMBOX_ADMIN_ID` | Admin `User` id for browser login. Set with `MDMBOX_ADMIN_PASSWORD`. | unset |
| `MDMBOX_ADMIN_PASSWORD` | Admin password. Set with `MDMBOX_ADMIN_ID`. | unset |
| `MDMBOX_API_CLIENT_ID` | API `Client` id for Basic authentication. Set with `MDMBOX_API_CLIENT_SECRET`. | unset |
| `MDMBOX_API_CLIENT_SECRET` | Secret for the bootstrapped API `Client`. Must be set together with `MDMBOX_API_CLIENT_ID`. | unset |

## Audit

MDMbox automatically records operation audit events. See [Audit](audit.md) for covered operations, querying, and retention.

## Match operation

| Variable | Description | Default |
| --- | --- | --- |
| `MDMBOX_MATCH_DEFAULT_COUNT` | Default maximum number of `$match` results when the request omits `count`. | `10` |
| `MDMBOX_TEFCA_MODE` | Enable R4 TEFCA `$match` behavior. When enabled, potential-match responses (`onlyCertainMatches=false`) return no more than 100 entries. | unset (`false`) |
| `MDMBOX_DEFAULT_FHIR_RELEASE` | FHIR release used by unversioned `/api/fhir/:resource/...` routes. Accepted values: `4.0.1` and `6.0.0`. | `6.0.0` |

## Merge and unmerge algorithms

Built-ins are enabled by default. Set `MDMBOX_BUILT_IN_ALGORITHMS` to a comma-separated allowlist such as `simple,strict`, or an empty value to disable all built-ins. IDs are case-sensitive; unknown IDs prevent startup. Restart after changing the setting.

Git and database scripts are configured separately. The default algorithm IDs are `simple` for merge and `restore` for unmerge. Make the selected default available as a built-in or custom script; an unavailable default returns HTTP 400.

| Variable | Description | Default |
| --- | --- | --- |
| `MDMBOX_BUILT_IN_ALGORITHMS` | Enabled built-ins: `simple`, `restore`, `strict` | unset (all enabled) |

Manage scripts and Git sources through **Algorithms** in the Admin UI. Runtime sources can be added and synchronized without restarting. The variables below configure a separate, reserved `environment` source:

| Variable | Description | Default |
| --- | --- | --- |
| `MDMBOX_ALGORITHM_GIT_URL` | HTTPS or SSH repository URL, or an absolute `file:///` URI. | unset |
| `MDMBOX_ALGORITHM_GIT_REF` | `HEAD`, full branch ref such as `refs/heads/main`, full tag ref such as `refs/tags/v1`, or a 40-character commit SHA. A remote must allow fetching the selected commit. | `HEAD` |
| `MDMBOX_ALGORITHM_GIT_USERNAME` | HTTPS authentication username; use the username required by the Git host for your token type. | `git` |
| `MDMBOX_ALGORITHM_GIT_TOKEN_FILE` | Absolute path to a mounted read-only secret containing the HTTPS token or password. | unset |
| `MDMBOX_ALGORITHM_GIT_CA_FILE` | Absolute path to an optional PEM CA bundle for a private HTTPS Git server. Certificate verification remains enabled. | system CA trust |

Setting a Git environment option requires a valid URL. This source refreshes at startup; invalid configuration, unavailable revisions, authentication errors, or invalid scripts prevent startup. Runtime sources retain their last published scripts without fetching on startup.

See [Algorithm management](algorithms.md) for setup, private access, precedence, and synchronization.

## Shared database configuration

Set MDMbox's `BOX_DB_*` values to the database used by Aidbox. For Aidbox database and FHIR configuration, see the [Aidbox settings reference](https://www.health-samurai.io/docs/aidbox/reference/all-settings).

| Variable          | Description                     | Required |
| ----------------- | ------------------------------- | -------- |
| `BOX_DB_HOST`     | PostgreSQL host                 | Yes      |
| `BOX_DB_PORT`     | PostgreSQL port (default: 5432) | No       |
| `BOX_DB_DATABASE` | Database name                   | Yes      |
| `BOX_DB_USER`     | Database user                   | Yes      |
| `BOX_DB_PASSWORD` | Database password               | Yes      |

### PostgreSQL extensions

MDMbox requires the PostgreSQL extensions `unaccent`, `fuzzystrmatch`, and `pg_trgm` and installs missing extensions at startup. If your database account does not have permission to install extensions, ask your database administrator to install them before starting MDMbox.

## MDMbox connection pools

MDMbox has a main connection pool for API and Admin UI traffic and a bulk pool for matching workers.

| Variable                  | Description              | Default |
| ------------------------- | ------------------------ | ------- |
| `MDMBOX_DB_MAX_POOL_SIZE` | Maximum main pool connections | 10 |
| `MDMBOX_DB_MIN_IDLE` | Minimum idle main pool connections | 1 |
| `MDMBOX_BULK_DB_MAX_POOL_SIZE` | Maximum bulk pool connections | 12 |
| `MDMBOX_BULK_DB_MIN_IDLE` | Minimum idle bulk pool connections | 0 |
| `MDMBOX_BULK_DB_IDLE_TIMEOUT_MS` | Time before unused bulk connections can be released, in milliseconds | 60000 |

Both bulk matching jobs and [continuous matching processes](continuous-matching.md) use the bulk pool. Each job or process reserves one connection per worker plus one for its coordinator, including during preparation. A Start that exceeds the bulk pool capacity is refused with HTTP 409. Include both pools, other applications and all replicas when sizing PostgreSQL's connection limit. See [continuous matching deployment and upgrades](continuous-matching.md#deployment-and-upgrades) for process handover and upgrade requirements.

## HTTP Server

| Variable           | Description | Default |
| ------------------ | ----------- | ------- |
| `MDMBOX_HTTP_PORT` | HTTP port | 3000 |
| `MDMBOX_HTTP_HOST` | Bind address | `0.0.0.0` in the Docker image; `127.0.0.1` otherwise |

## Logging

| Variable | Description | Default |
| -------- | ----------- | ------- |
| `MDMBOX_LOG_LEVEL` | Application log level in the Docker image: `trace`, `debug`, `info`, `warn`, `error`, or `off` (case-insensitive) | `info` |

For example, add this to the MDMbox service in Docker Compose:

```yaml
environment:
  MDMBOX_LOG_LEVEL: debug
```

With the Helm chart, set `config.MDMBOX_LOG_LEVEL` to the desired level. Restart the container after changing the setting. Empty or unsupported values prevent startup with an error.

## Related Pages

- [Getting started](getting-started.md)
- [Authentication](authentication.md)
- [Find duplicates: $match](match-operation.md)
