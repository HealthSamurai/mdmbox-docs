---
description: Deploy MDMbox with Docker Compose in standalone or shared Aidbox mode.
---

# Getting started

MDMbox is distributed as a Docker image: `healthsamurai/mdmbox`.

It requires a PostgreSQL 14+ database. All configuration is done through environment variables.

## Standalone deployment

In standalone mode, MDMbox manages its own database. You need two containers:  PostgreSQL and MDMbox.

{% file src="/docs/mdmbox/assets/examples/docker-compose.standalone.yml" %}
docker-compose.yml
{% endfile %}

Start the services:

```bash
docker compose up
```

MDMbox is available at `http://localhost:3000`. Open `http://localhost:3000/api/docs` for the Swagger UI.

## As Aidbox plugin

When you already have an Aidbox instance, MDMbox can connect to the same PostgreSQL database. Both services share FHIR data.

Each MDMbox release is built for a specific Aidbox version. Contact us to get a build compatible with your Aidbox version.

Pass the same `BOX_*` environment variables to MDMbox that your Aidbox uses:

{% file src="/docs/mdmbox/assets/examples/docker-compose.shared.yml" %}
docker-compose.yml
{% endfile %}

{% hint style="warning" %}
The `BOX_*` environment variables must match your Aidbox configuration exactly. MDMbox and Aidbox share the same PostgreSQL instance, FHIR data, and engine settings.
{% endhint %}

## Configuration reference

### Database

MDMbox uses the standard Aidbox database environment variables:

| Variable | Description | Required |
| --- | --- | --- |
| `BOX_DB_HOST` | PostgreSQL host | Yes |
| `BOX_DB_PORT` | PostgreSQL port (default: 5432) | No |
| `BOX_DB_DATABASE` | Database name | Yes |
| `BOX_DB_USER` | Database user | Yes |
| `BOX_DB_PASSWORD` | Database password | Yes |

### FHIR engine

MDMbox includes an embedded FHIR engine that uses the standard Aidbox `BOX_*` environment variables. In shared mode, these must match your Aidbox configuration. See the docker-compose examples above for the full list.

Key settings: `BOX_BOOTSTRAP_FHIR_PACKAGES`, `BOX_FHIR_SEARCH_ENGINE`, `BOX_FHIR_COMPLIANT_MODE`, `BOX_SECURITY_DEV_MODE`, `BOX_ROOT_CLIENT_ID`, `BOX_ROOT_CLIENT_SECRET`.

### MDMbox connection pool

MDMbox maintains its own connection pool separate from the embedded FHIR engine. Both pools connect to the same database but are sized independently.

| Variable | Description | Default |
| --- | --- | --- |
| `MDMBOX_DB_MAX_POOL_SIZE` | Maximum pool connections | 10 |
| `MDMBOX_DB_MIN_IDLE` | Minimum idle connections | 1 |

### HTTP server

| Variable | Description | Default |
| --- | --- | --- |
| `MDMBOX_HTTP_PORT` | HTTP port | 3000 |

## Endpoints

Once running, the following endpoints are available:

| URL | Description |
| --- | --- |
| `/healthz` | Liveness check |
| `/readyz` | Readiness check (verifies database connectivity) |
| `/api/docs` | Swagger UI |
| `/api/openapi.json` | OpenAPI specification |
| `/admin` | Admin UI |

## Next steps

{% content-ref %}
[Matching models](matching-models.md)
{% endcontent-ref %}

{% content-ref %}
[Find duplicates: $match](match-operation.md)
{% endcontent-ref %}
