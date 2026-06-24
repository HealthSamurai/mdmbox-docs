---
description: Environment variables and runtime configuration for MDMbox.
---

# Configuration reference

MDMbox is configured through environment variables.

## License

MDMbox requires a license to start. There are two ways to activate it:

1. **Environment variable.** Sign in to the [Aidbox portal](https://aidbox.app/ui/portal), open the MDMbox project, copy the license JWT, and pass it to the MDMbox container as `MDMBOX_LICENSE`. Recommended for production and CI.
2. **Browser activation.** Leave `MDMBOX_LICENSE` unset and start MDMbox. Open `http://localhost:3000`, click **Continue with Aidbox account**, sign in to the portal — a development MDMbox license is generated and stored in the database automatically. Useful for local development.

| Variable | Description | Required |
| --- | --- | --- |
| `MDMBOX_LICENSE` | License JWT copied from the Aidbox portal | No — falls back to browser activation |

## Authentication

Authentication is enabled by default. When enabled, MDMbox protects both API
endpoints and the Admin UI:

- API endpoints require a valid `Authorization` header.
- The Admin UI uses browser session authentication and redirects unauthenticated
  users to `/login`.
- Health checks, Swagger UI, and the OpenAPI specification remain public.

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

## Database

MDMbox uses the standard Aidbox database environment variables:

| Variable | Description | Required |
| --- | --- | --- |
| `BOX_DB_HOST` | PostgreSQL host | Yes |
| `BOX_DB_PORT` | PostgreSQL port (default: 5432) | No |
| `BOX_DB_DATABASE` | Database name | Yes |
| `BOX_DB_USER` | Database user | Yes |
| `BOX_DB_PASSWORD` | Database password | Yes |

## MDMbox Connection Pool

MDMbox maintains its own connection pool separate from the embedded FHIR engine. Both pools connect to the same database but are sized independently.

| Variable | Description | Default |
| --- | --- | --- |
| `MDMBOX_DB_MAX_POOL_SIZE` | Maximum pool connections | 10 |
| `MDMBOX_DB_MIN_IDLE` | Minimum idle connections | 1 |

## HTTP Server

| Variable | Description | Default |
| --- | --- | --- |
| `MDMBOX_HTTP_PORT` | HTTP port | 3000 |

## Related Pages

- [Getting started](getting-started.md)
- [Find duplicates: $match](match-operation.md)
