---
description: Deploy MDMbox with Docker Compose in standalone or shared Aidbox mode.
---

# Getting started

MDMbox is distributed as versioned Docker images under
`healthsamurai/mdmbox`. Select a
[published release tag](https://hub.docker.com/r/healthsamurai/mdmbox/tags) and
set `MDMBOX_VERSION` before using the Compose examples. Release tags include the
compatible Aidbox version, for example `2604.2-aidbox2603.0`.

It requires a PostgreSQL 14+ database. All configuration is done through environment variables.

The `docker-compose.yml` snippets below are minimal **examples for local trial runs** — clone, tweak, `docker compose up`. For Kubernetes, see [Kubernetes (Helm)](#kubernetes-helm).

```bash
export MDMBOX_VERSION=2604.2-aidbox2603.0
```

## Standalone deployment

In standalone mode, MDMbox manages its own database. You need two containers:  PostgreSQL and MDMbox.

{% file src="/docs/mdmbox/assets/examples/docker-compose.standalone.yml?v=352046fa84ff2a5f" %}
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

{% file src="/docs/mdmbox/assets/examples/docker-compose.shared.yml?v=adfa501b29a8c1a6" %}
docker-compose.yml
{% endfile %}

{% hint style="warning" %}
The `BOX_*` environment variables must match your Aidbox configuration exactly. MDMbox and Aidbox share the same PostgreSQL instance, FHIR data, and engine settings.
{% endhint %}

## Kubernetes (Helm)

For Kubernetes, MDMbox is published as a Helm chart: [HealthSamurai/helm-charts/mdmbox](https://github.com/HealthSamurai/helm-charts/tree/main/mdmbox). The chart does not provision PostgreSQL — bring your own (managed service, in-cluster operator, or [bitnami/postgresql](https://artifacthub.io/packages/helm/bitnami/postgresql)) — and supports the same two modes as the Compose examples above.

Pin the same release tag in `values.yaml`:

```yaml
image:
  tag: 2604.2-aidbox2603.0
```

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

## Configuration

For production, pass `MDMBOX_LICENSE` as an environment variable. For local
trial runs, you can leave it unset and activate MDMbox in the browser after
startup.

See [Authentication](authentication.md) for API and Admin UI authentication.
See [Configuration reference](config-reference.md) for all environment
variables and runtime defaults.

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
