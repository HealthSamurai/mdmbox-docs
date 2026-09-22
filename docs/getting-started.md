---
description: Deploy MDMbox together with Aidbox using Docker Compose or Helm.
---

# Getting started

MDMbox is distributed as versioned Docker images under `healthsamurai/mdmbox` and is deployed together with Aidbox. Select a [published release tag](https://hub.docker.com/r/healthsamurai/mdmbox/tags) and set `MDMBOX_VERSION` before using the Compose examples. New exact release tags use `YYMM.N`, where `YYMM` is the release year and month and `N` is the minor number, starting at `0`. For example, use `2608.3` for a fixed release or `2608` for the latest minor of that month. To update, pull the image and recreate the container. The MDMbox tag does not encode the Aidbox version.

New releases are checked against the latest minor of every Aidbox monthly release from the current LTS through the newest release, including the LTS itself. The tested Aidbox versions at publication are recorded in the image label `io.healthsamurai.mdmbox.aidbox-versions`. Pin one of those versions for your Aidbox deployment. Release images support Linux amd64 and arm64.

After pulling a new release, inspect its tested versions:

```bash
docker pull healthsamurai/mdmbox:$MDMBOX_VERSION
docker image inspect --format '{{ index .Config.Labels "io.healthsamurai.mdmbox.aidbox-versions" }}' healthsamurai/mdmbox:$MDMBOX_VERSION
```

The deployment requires Aidbox and a PostgreSQL 14+ database. Aidbox and MDMbox run as separate services against the same database. All configuration is done through environment variables.

The `docker-compose.yml` below is a minimal **example for local trial runs** — clone, tweak, `docker compose up`. For Kubernetes, see [Kubernetes (Helm)](#kubernetes-helm).

```bash
export MDMBOX_VERSION=2604.2-aidbox2603.0
export AIDBOX_VERSION=2603.0
```

## Docker Compose

The example starts PostgreSQL, Aidbox, and MDMbox. Aidbox and MDMbox share the same FHIR data and must receive the same `BOX_*` database and relevant `BOX_FHIR_*` settings.

{% file src="/docs/mdmbox/assets/examples/docker-compose.shared.yml?v=6b761cd00891c272" %}
docker-compose.yml
{% endfile %}

Start the services:

```bash
docker compose up
```

Aidbox is available at `http://localhost:8888`. MDMbox is available at `http://localhost:3000`; open `http://localhost:3000/api/docs` for its Swagger UI.

{% hint style="warning" %}
The shared database connection variables and relevant `BOX_FHIR_*` variables must match your Aidbox configuration. MDMbox and Aidbox use the same PostgreSQL database and FHIR data.
{% endhint %}

## Kubernetes (Helm)

For Kubernetes, MDMbox is published as a Helm chart: [HealthSamurai/helm-charts/mdmbox](https://github.com/HealthSamurai/helm-charts/tree/main/mdmbox). The chart adds MDMbox to an existing Aidbox deployment; it does not provision Aidbox or PostgreSQL. Point it at the same database configuration used by Aidbox.

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

Reuse the `ConfigMap` and `Secret` from the Aidbox deployment by passing them through `aidboxConfigMap` and `aidboxSecret`:

```yaml
aidboxConfigMap: aidbox-config # BOX_DB_HOST, BOX_DB_PORT, BOX_DB_DATABASE...
aidboxSecret: aidbox-secret # BOX_DB_USER, BOX_DB_PASSWORD...

config:
  MDMBOX_LICENSE: <license JWT>
```

Database connection values are shared with Aidbox. Put MDMbox-only settings, including its license and connection pool sizing, under `config:` or in a separate MDMbox `Secret` as appropriate.

The full list of values is in the [chart README](https://github.com/HealthSamurai/helm-charts/blob/main/mdmbox/README.md).

## Configuration

For production, pass `MDMBOX_LICENSE` as an environment variable. For local trial runs, you can leave it unset and activate MDMbox in the browser after startup.

See [Authentication](authentication.md) for API and Admin UI authentication. See [Configuration reference](config-reference.md) for all environment variables and runtime defaults.

## Endpoints

Once running, use Aidbox for the FHIR API and MDMbox for MDM operations and its Admin UI:

| Service | URL | Description |
| --- | --- | --- |
| Aidbox | `http://localhost:8888/fhir` | FHIR API |
| MDMbox | `http://localhost:3000/healthz` | Liveness check |
| MDMbox | `http://localhost:3000/readyz` | Readiness check (verifies database connectivity) |
| MDMbox | `http://localhost:3000/api/docs` | Swagger UI |
| MDMbox | `http://localhost:3000/api/openapi.json` | OpenAPI specification |
| MDMbox | `http://localhost:3000/admin` | Admin UI |

## Next steps

The onboarding page and its actions produce [audit events](audit.md). Page and initialization events are coalesced to limit duplicates. Importing sample patients and installing the starter model require a request event before execution; other steps record their result. Login/logout are also audited, without storing credentials or patient payloads in the interaction events.

{% content-ref %}
[Matching models](matching-models.md)
{% endcontent-ref %}

{% content-ref %}
[Find duplicates: $match](match-operation.md)
{% endcontent-ref %}
