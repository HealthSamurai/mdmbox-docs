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

Git storage is optional and read-only. Configure a small, administrator-controlled
repository containing `merge/<id>.js` and/or `unmerge/<id>.js`. The repository is
fetched once at startup; restart MDMbox to pick up a changed branch or tag. See
[Git algorithm storage](merge-operation.md#git-algorithm-storage) for layout,
private access, limits, and precedence.

| Variable | Description | Default |
| --- | --- | --- |
| `MDMBOX_ALGORITHM_GIT_URL` | HTTPS or SSH repository URL, or an absolute `file:///` URI. Do not put passwords or tokens in the URL. | unset (Git storage disabled) |
| `MDMBOX_ALGORITHM_GIT_REF` | `HEAD`, full branch ref such as `refs/heads/main`, full tag ref such as `refs/tags/v1`, or a 40-character commit SHA. A remote must allow fetching the selected commit. | `HEAD` |
| `MDMBOX_ALGORITHM_GIT_USERNAME` | HTTPS authentication username; use the username required by the Git host for your token type. | `git` |
| `MDMBOX_ALGORITHM_GIT_TOKEN_FILE` | Path to a mounted read-only secret containing the HTTPS token or password. | unset |
| `MDMBOX_ALGORITHM_GIT_CA_FILE` | Optional PEM CA bundle for a private HTTPS Git server. Certificate verification remains enabled. | system CA trust |

Setting any Git option requires a valid repository URL. Invalid configuration,
authentication failure, missing revision, or invalid scripts prevent startup;
MDMbox does not silently substitute another revision or a stale cache.

## Shared database configuration

Aidbox and MDMbox run as separate applications against the same PostgreSQL database. MDMbox accepts the standard Aidbox `BOX_DB_*` environment variables so the database connection configuration can be shared between both application environments. Pass the same values to Aidbox and MDMbox.

| Variable          | Description                     | Required |
| ----------------- | ------------------------------- | -------- |
| `BOX_DB_HOST`     | PostgreSQL host                 | Yes      |
| `BOX_DB_PORT`     | PostgreSQL port (default: 5432) | No       |
| `BOX_DB_DATABASE` | Database name                   | Yes      |
| `BOX_DB_USER`     | Database user                   | Yes      |
| `BOX_DB_PASSWORD` | Database password               | Yes      |

## MDMbox connection pool

The database connection settings are shared, but connection pool sizing is application-specific. Configure the MDMbox pool independently for its workload using the variables below; these values do not change the Aidbox application's pool size.

| Variable                  | Description              | Default |
| ------------------------- | ------------------------ | ------- |
| `MDMBOX_DB_MAX_POOL_SIZE` | Maximum pool connections | 10      |
| `MDMBOX_DB_MIN_IDLE`      | Minimum idle connections | 1       |

## HTTP Server

| Variable           | Description | Default |
| ------------------ | ----------- | ------- |
| `MDMBOX_HTTP_PORT` | HTTP port   | 3000    |

## Related Pages

- [Getting started](getting-started.md)
- [Authentication](authentication.md)
- [Find duplicates: $match](match-operation.md)
