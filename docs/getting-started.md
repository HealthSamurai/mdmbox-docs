---
description: Deploy MDMbox together with Aidbox using Docker Compose or Helm.
---

# Getting started

This walkthrough starts MDMbox, Aidbox, and PostgreSQL on your computer. You need Docker Compose and an [Aidbox account](https://aidbox.app/ui/portal) to activate development licenses.

Aidbox stores and serves FHIR resources. MDMbox connects to the same PostgreSQL database and provides matching and record-management operations. For an existing Kubernetes deployment, see [Kubernetes (Helm)](#kubernetes-helm).

## Versions and compatibility

MDMbox is compatible with Aidbox from the current LTS through the latest release, including LTS. Every MDMbox release is tested with each Aidbox monthly version in that range. The MDMbox and Aidbox version numbers do not need to match.

For a local trial, use `healthsamurai/mdmbox:latest` together with `healthsamurai/aidboxone:latest`. To stay on a selected monthly version, use its tag, such as `2608`. Monthly tags receive updates within that version.

Compatible Aidbox versions for each MDMbox monthly version are listed in [Release notes](release-notes.md).

[Published MDMbox images](https://hub.docker.com/r/healthsamurai/mdmbox/tags) support Linux amd64 and arm64:

| Tag | What it selects |
| --- | --- |
| `latest` | The newest published version, including its updates. Moves forward as new versions are released. |
| `YYMM`, for example `2608` | A selected monthly version, including its updates. |
| `edge` | A development build. Use a released monthly version for production. |

Use PostgreSQL 14 or later and pass the same `BOX_DB_*` and relevant `BOX_FHIR_*` settings to Aidbox and MDMbox.

## Docker Compose

### 1. Download the configuration

Save this file as `docker-compose.yml` in an empty directory:

{% file src="/docs/mdmbox/assets/examples/docker-compose.shared.yml?v=64968a2f52bfbbb1" %}
docker-compose.yml
{% endfile %}

The example is for local use and includes development credentials. Aidbox and MDMbox receive the same database and FHIR settings.

### 2. Start the services

Run these commands from the directory containing `docker-compose.yml` to start the latest releases of both services:

```bash
docker compose pull
docker compose up -d
```

To stay on selected monthly versions, replace `latest` in the services' `image` values with their monthly tags. For an existing Aidbox deployment, keep its version within the [supported range](#versions-and-compatibility).

Initial startup downloads images and FHIR packages and can take several minutes. Follow progress with `docker compose logs -f`.

### 3. Activate and sign in

1. Open `http://localhost:8888` and activate Aidbox following the [Aidbox setup guide](https://www.health-samurai.io/docs/aidbox/getting-started/run-aidbox-locally).
2. Open `http://localhost:3000` and click **Sign in to activate** to activate MDMbox with your Aidbox account.
3. If the MDMbox login form appears, use `postgres` as both the username and password for this local example.

For unattended MDMbox activation, set `MDMBOX_LICENSE`. See [Configuration reference](config-reference.md#license). For Aidbox activation, see [Aidbox licensing](https://www.health-samurai.io/docs/aidbox/overview/aidbox-user-portal/licenses).

If the Admin UI shows **Activate Aidbox**, follow its link and complete Aidbox activation. The banner disappears after activation. For an Aidbox address other than `http://localhost:8888`, set [`MDMBOX_AIDBOX_URL`](config-reference.md#aidbox-url) to the public Aidbox URL.

### 4. Try matching

Open `http://localhost:3000/welcome`. Follow the steps to import sample patients, install the starter matching model, and run a match. You can skip importing samples if your database already has patients.

Use `/admin` to inspect models, or `/api/docs` to explore the API. For API calls in this local example, use the configured client credentials:

```bash
curl --user root:secret http://localhost:3000/api/models
```

The starter model is a `MatchingModel` for `$match`. To try Bulk or Continuous matching, first create the [BulkMatchingModel example](matching-models.md#bulkmatchingmodel).

### Stop or update

`docker compose down` stops the services and keeps the database volume. To update this local trial, run `docker compose pull` followed by `docker compose up -d`. With `latest`, this updates both services to their latest releases; with a monthly tag, it updates within that series.

## Kubernetes (Helm)

The [MDMbox Helm chart](https://github.com/HealthSamurai/helm-charts/tree/main/mdmbox) installs MDMbox alongside an existing Aidbox deployment. Use its database configuration.

Use an Aidbox version within the [supported range](#versions-and-compatibility). Create `values.yaml` using the names of your existing Aidbox ConfigMap and Secret. This example follows `latest`; to stay on a selected monthly version, set `image.tag` to its monthly tag:

```yaml
image:
  tag: "latest"
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

Create `mdmbox-secret` with `MDMBOX_LICENSE` and install MDMbox in the **same namespace** as these ConfigMaps and Secrets. The example uses namespace `aidbox`; replace it with yours. See [Continuous matching deployment and upgrades](continuous-matching.md#deployment-and-upgrades) for matching behavior during updates.

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

See [Authentication](authentication.md) for API and browser login, and [Configuration reference](config-reference.md) for environment variables and defaults.

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
