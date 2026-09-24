---
description: Deploy MDMbox together with Aidbox using Docker Compose or Helm.
---

# Getting started

This walkthrough starts MDMbox, Aidbox, and PostgreSQL on your computer. You need Docker Compose and an [Aidbox account](https://aidbox.app/ui/portal) to activate development licenses.

Aidbox stores and serves FHIR resources. MDMbox connects to the same PostgreSQL database and provides matching and record-management operations. For an existing Kubernetes deployment, see [Kubernetes (Helm)](#kubernetes-helm).

## Docker Compose

### 1. Download the configuration

Save this file as `docker-compose.yml` in an empty directory:

{% file src="/docs/mdmbox/assets/examples/docker-compose.shared.yml?v=3295c8d795c538ed" %}
docker-compose.yml
{% endfile %}

The example is for local use and includes development credentials. Aidbox and MDMbox receive the same database and FHIR settings.

### 2. Start the services

Run these commands from the directory containing `docker-compose.yml`:

```bash
export MDMBOX_VERSION=2608
export AIDBOX_VERSION=2608.4
docker compose up -d
```

Initial startup downloads images and FHIR packages and can take several minutes. Follow progress with `docker compose logs -f`.

### 3. Activate and sign in

1. Open `http://localhost:8888` and follow the Aidbox activation flow.
2. Open `http://localhost:3000` and activate MDMbox with your Aidbox account.
3. If the MDMbox login form appears, use `postgres` as both the username and password for this local example.

For deployments with an existing license, set `MDMBOX_LICENSE` in the MDMbox environment. See [Configuration reference](config-reference.md#license).

### 4. Try matching

Open `http://localhost:3000/welcome`. Follow the steps to import sample patients, install the starter matching model, and run a match. You can skip importing samples if your database already has patients.

Use `/admin` to inspect models, or `/api/docs` to explore the API. For API calls in this local example, use the configured client credentials:

```bash
curl --user root:secret http://localhost:3000/api/models
```

The starter model is a `MatchingModel` for `$match`. To try Bulk or Continuous matching, first create the [BulkMatchingModel example](matching-models.md#bulkmatchingmodel).

### Stop or update

`docker compose down` stops the services and keeps the database volume. To update the selected monthly release, run `docker compose pull` followed by `docker compose up -d`, with the version variables still set.

## Versions and compatibility

Use `healthsamurai/mdmbox:2608` for the latest minor in the August 2026 series, or `healthsamurai/mdmbox:2608.0` for that exact release. [Published images](https://hub.docker.com/r/healthsamurai/mdmbox/tags) support Linux amd64 and arm64. The MDMbox tag does not determine the Aidbox version.

Each release is tested against the latest available minor of every Aidbox monthly series from the latest LTS through the newest series, including LTS. The image records the tested versions at publication. Before changing Aidbox, inspect that list and choose one of its versions:

```bash
docker pull healthsamurai/mdmbox:2608
docker image inspect --format '{{ index .Config.Labels "io.healthsamurai.mdmbox.aidbox-versions" }}' healthsamurai/mdmbox:2608
```

For an existing deployment, use PostgreSQL 14 or later and pass the same `BOX_DB_*` and relevant `BOX_FHIR_*` settings to Aidbox and MDMbox.

## Kubernetes (Helm)

For Kubernetes, MDMbox is published as a Helm chart: [HealthSamurai/helm-charts/mdmbox](https://github.com/HealthSamurai/helm-charts/tree/main/mdmbox). The chart adds MDMbox to an existing Aidbox deployment; it does not provision Aidbox or PostgreSQL. Point it at the same database configuration used by Aidbox.

Create `values.yaml` using the names of your existing Aidbox ConfigMap and Secret:

```yaml
image:
  tag: "2608"
  pullPolicy: Always

aidboxConfigMap: aidbox-config
aidboxSecret: aidbox-secret
extraEnvFromSecrets:
  - mdmbox-secret # Contains MDMBOX_LICENSE

replicaCount: 1
autoscaling:
  enabled: false
updateStrategy:
  type: Recreate
  rollingUpdate: null
```

Create `mdmbox-secret` with `MDMBOX_LICENSE` and install MDMbox in the **same namespace** as these ConfigMaps and Secrets. The example uses namespace `aidbox`; replace it with yours. The single replica and `Recreate` strategy support [Continuous matching recovery](continuous-matching.md#deployment-and-upgrades).

```bash
helm repo add healthsamurai https://healthsamurai.github.io/helm-charts
helm repo update

helm upgrade --install mdmbox healthsamurai/mdmbox \
  --namespace aidbox \
  --values values.yaml
```

Put non-secret MDMbox settings, such as connection pool sizes, under `config:`. Use `extraEnvFromSecrets` for the MDMbox license and credentials.

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
| MDMbox | `http://localhost:3000/readyz` | Readiness check (database and FHIR service) |
| MDMbox | `http://localhost:3000/api/docs` | Swagger UI |
| MDMbox | `http://localhost:3000/api/openapi.json` | OpenAPI specification |
| MDMbox | `http://localhost:3000/admin` | Admin UI |

## Next steps

- Compare one record with [$match](match-operation.md).
- Find pairs across your dataset with [Bulk matching](bulk-match.md) or [Continuous matching](continuous-matching.md).
- Explore [runnable integrations](https://github.com/HealthSamurai/mdmbox-playground/tree/main/examples), including review, linking, and automatic merging.

{% content-ref %}
[Matching models](matching-models.md)
{% endcontent-ref %}

{% content-ref %}
[Find duplicates: $match](match-operation.md)
{% endcontent-ref %}
