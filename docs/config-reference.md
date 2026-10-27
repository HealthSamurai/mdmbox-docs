---
description: Environment variables and runtime configuration for MDMbox.
---

# Configuration reference

MDMbox is configured through environment variables.

For the Prometheus listener and its environment variables, see [Monitoring](monitoring.md).

## License

MDMbox requires an active license. Choose an activation method:

1. **Production and CI:** obtain an MDMbox license from the [portal](https://aidbox.app/ui/portal) and set `MDMBOX_LICENSE` in the MDMbox environment.
2. **Local development:** start MDMbox, open `/mdmbox` on your Aidbox address (`http://localhost:8888/mdmbox` in the local example), sign in to Aidbox, and click **Sign in to activate** to issue a development license with your portal account. Operations are available immediately after activation. The license is saved in the database and reused on restart. Replicas waiting for activation on the same database pick up the saved license automatically.

Before activation, MDMbox redirects API and Admin UI requests to its activation page. If an upgrade finds multiple previously saved MDMbox licenses, the page explains the ambiguity: set `MDMBOX_LICENSE` to the intended license and restart, or issue a new development license through the page.

An invalid, expired, or inactive configured or saved license prevents startup. Check the startup log for the verification error, set `MDMBOX_LICENSE` to a valid MDMbox license, and restart.

If a running instance's license expires or becomes inactive, MDMbox returns HTTP 403 with `{"error":"MDMbox license verification failed"}`. A temporary license portal outage allows a 24-hour grace period; requests receive the same HTTP 403 response after that period expires. Both `/healthz` and `/readyz` remain available while activation is pending or a running instance is restricted.

For Aidbox activation, see [Aidbox licensing](https://www.health-samurai.io/docs/aidbox/overview/aidbox-user-portal/licenses).

| Variable | Description | Required |
| --- | --- | --- |
| `MDMBOX_LICENSE` | MDMbox license JWT | For unattended activation |

## Aidbox URL

Pass Aidbox's `BOX_WEB_BASE_URL` to MDMbox as well. MDMbox uses the same public Aidbox address for the **Activate Aidbox** link in the Admin UI and the `fullUrl` values in `$match` and `$referencing` results. Use the address that users and API clients use to access Aidbox. With Helm, the existing `aidboxConfigMap` supplies it when the variable is present there.

The URL is required and has no default. An unset, empty, or invalid value prevents startup with an error naming `BOX_WEB_BASE_URL`. Use an absolute `http://` or `https://` URL without a query or fragment, for example `https://aidbox.example.com`. A deployment path such as `https://example.com/aidbox` is supported; trailing slashes are removed. This setting does not configure the database connection; supply `BOX_DB_*` separately.

The deprecated Aidbox alias `AIDBOX_BASE_URL` is also accepted. If both variables are present, `BOX_WEB_BASE_URL` takes precedence, as in [Aidbox's Base URL setting](https://www.health-samurai.io/docs/aidbox/reference/all-settings#base-url). Set the same variable and value in both services; a shared ConfigMap avoids duplicating it.

| Variable | Description | Required |
| --- | --- | --- |
| `BOX_WEB_BASE_URL` | Public base URL of Aidbox, shared with MDMbox | Yes, unless the legacy alias is supplied |
| `AIDBOX_BASE_URL` | Deprecated alias for `BOX_WEB_BASE_URL` | No |

## Authentication

Authentication is enabled by default. Direct API requests use an `Authorization` header; the Admin UI uses the Aidbox browser session and AccessPolicies through `App/mdmbox`. See [Authentication](authentication.md) for setup and examples.

`MDMBOX_ADMIN_ROLE` is no longer used. UI access is granted by Aidbox AccessPolicies, including the initial policy created for `MDMBOX_ADMIN_ID`.

| Variable | Description | Default |
| --- | --- | --- |
| `MDMBOX_AUTH_ENABLED` | Require authentication for API endpoints and Admin UI access through Aidbox. When `false` on `edge`, direct Admin UI access on the MDMbox address is allowed without sign-in. Accepted values: `true` or `false`. | `true` |
| `MDMBOX_ADMIN_ID` | Initial Aidbox `User` id with a seeded AccessPolicy for the MDMbox UI. Set with `MDMBOX_ADMIN_PASSWORD`. | unset |
| `MDMBOX_ADMIN_PASSWORD` | Admin password. Set with `MDMBOX_ADMIN_ID`. | unset |
| `MDMBOX_API_CLIENT_ID` | API `Client` id for Basic authentication. Set with `MDMBOX_API_CLIENT_SECRET`. | unset |
| `MDMBOX_API_CLIENT_SECRET` | Secret for the bootstrapped API `Client`. Must be set together with `MDMBOX_API_CLIENT_ID`. | unset |
| `MDMBOX_AIDBOX_APP_ENDPOINT_URL` | MDMbox App endpoint URL reachable from Aidbox. | `http://mdmbox:3000/api/aidbox-app-proxy` |
| `MDMBOX_API_AIDBOX_APP_ONLY` | Accept protected API requests only through an authenticated Aidbox App, preventing direct bypass of Aidbox AccessPolicies. | `false` |

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

## Model builder

**Available from:** `edge`.

Model builder uses PostgreSQL to profile Patient records and store selected fields in a training table. By default it uses the configured MDMbox database. The workspace stores prepared data in the database and survives normal application restarts.

| Variable | Description | Default |
| --- | --- | --- |
| `MDMBOX_MODEL_BUILDER_JDBC_URL` | Optional PostgreSQL JDBC URL for a separate training source and workspace | MDMbox database |

When using a separate database, supply any required credentials and TLS settings in the JDBC URL. The account must read `public.patient` and create the workspace schema, tables and matching functions. The database must provide the standard `fuzzystrmatch`, `unaccent` and `pg_trgm` extensions; Model builder installs missing prerequisites when the account has permission. No custom native extension is required.

The source override affects the builder workspace only. Saved models and online, Bulk and Continuous matching use MDMbox's configured database. The former `MDMBOX_MODEL_BUILDER_DUCKDB` setting is no longer used. See [Model builder preview](matching-models.md#model-builder-preview) for preparation and upgrade steps.

## AI assistant

**Available from:** `edge`.

The Learning assistant supports OpenAI and Anthropic. Configure one or both providers and restart MDMbox. A provider becomes available when both its key and model are set. Choose a model available to your provider account.

| Variable | Description | Default |
|----------|-------------|---------|
| `MDMBOX_OPENAI_API_KEY` | Server-side OpenAI API key | Unset |
| `MDMBOX_OPENAI_MODEL` | OpenAI model ID | Unset |
| `MDMBOX_OPENAI_BASE_URL` | API base URL serving the Responses endpoint | `https://api.openai.com/v1` |
| `MDMBOX_ANTHROPIC_API_KEY` | Server-side Anthropic API key | Unset |
| `MDMBOX_ANTHROPIC_MODEL` | Anthropic model ID | Unset |
| `MDMBOX_ANTHROPIC_BASE_URL` | API base URL serving the Messages endpoint | `https://api.anthropic.com/v1` |

Provide keys through deployment secrets. The browser receives provider availability and model names, without keys. Kubernetes deployments can use the chart's `extraEnvFromSecrets` and `extraEnvFromConfigMaps` settings. The assistant sends messages, code, field names and aggregate counts to the selected provider when you send a request; it excludes sample records and REPL output. See [AI assistant](matching-models.md#ai-assistant) for the review workflow.
