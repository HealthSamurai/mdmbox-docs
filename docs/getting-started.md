---
description: Deploy MDMbox with Docker Compose in standalone or shared Aidbox mode.
---

# Getting started

MDMbox is distributed as a Docker image: `healthsamurai/mdmbox`.

It requires a PostgreSQL 14+ database. All configuration is done through environment variables.

The `docker-compose.yml` snippets below are minimal **examples for local trial runs** — clone, tweak, `docker compose up`. For Kubernetes, see [Kubernetes (Helm)](#kubernetes-helm).

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

## Kubernetes (Helm)

For Kubernetes, MDMbox is published as a Helm chart: [HealthSamurai/helm-charts/mdmbox](https://github.com/HealthSamurai/helm-charts/tree/main/mdmbox). The chart does not provision PostgreSQL — bring your own (managed service, in-cluster operator, or [bitnami/postgresql](https://artifacthub.io/packages/helm/bitnami/postgresql)) — and supports the same two modes as the Compose examples above.

```bash
helm repo add healthsamurai https://healthsamurai.github.io/helm-charts

helm upgrade --install mdmbox healthsamurai/mdmbox \
  --namespace mdmbox --create-namespace \
  --values values.yaml
```

{% tabs %}
{% tab title="Standalone" %}
Put non-secret `BOX_DB_*` values in `config:` and reference a `Secret` you created with the credentials via `extraEnvFromSecrets`:

```yaml
config:
  MDMBOX_LICENSE: <license JWT>
  BOX_DB_HOST: postgres
  BOX_DB_PORT: "5432"
  BOX_DB_DATABASE: mdmbox

extraEnvFromSecrets:
  - mdmbox-db   # contains BOX_DB_USER, BOX_DB_PASSWORD
```

{% endtab %}
{% tab title="Alongside Aidbox" %}
Reuse the `ConfigMap` and `Secret` your Aidbox already has — point the chart at them via `aidboxConfigMap` / `aidboxSecret`:

```yaml
aidboxConfigMap: aidbox-config   # BOX_DB_HOST, BOX_DB_PORT, BOX_DB_DATABASE...
aidboxSecret: aidbox-secret      # BOX_DB_USER, BOX_DB_PASSWORD...

config:
  MDMBOX_LICENSE: <license JWT>
```

{% endtab %}
{% endtabs %}

The full list of values is in the [chart README](https://github.com/HealthSamurai/helm-charts/blob/main/mdmbox/README.md).

## License

MDMbox requires a license to start. There are two ways to activate it:

1. **Environment variable.** Sign in to the [Aidbox portal](https://aidbox.app/ui/portal), open the MDMbox project, copy the license JWT, and pass it to the MDMbox container as `MDMBOX_LICENSE`. Recommended for production and CI.
2. **Browser activation.** Leave `MDMBOX_LICENSE` unset and start MDMbox. Open `http://localhost:3000`, click **Continue with Aidbox account**, sign in to the portal — a development MDMbox license is generated and stored in the database automatically. Useful for local development.

| Variable | Description | Required |
| --- | --- | --- |
| `MDMBOX_LICENSE` | License JWT copied from the Aidbox portal | No — falls back to browser activation |

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
