---
description: Deploy MDMbox alongside an existing Aidbox installation using the Helm chart.
---

# Kubernetes deployment

The [MDMbox Helm chart](https://github.com/HealthSamurai/helm-charts/tree/main/mdmbox) installs MDMbox alongside an existing Aidbox deployment. Use its database configuration and an Aidbox version within the [supported range](versions-and-compatibility.md).

## Configure the chart

Create `values.yaml` using the names of your existing Aidbox ConfigMap and Secret. The ConfigMap should contain `BOX_WEB_BASE_URL` with the public Aidbox base URL as well as the shared database settings. MDMbox reads the address from that same ConfigMap.

Set `image.tag` explicitly to the monthly version you want to run. `pullPolicy: Always` lets replacement pods pick up updates published under that tag.

```yaml
image:
  tag: "2608"
  pullPolicy: Always

aidboxConfigMap: aidbox-config
aidboxSecret: aidbox-secret
extraEnvFromSecrets:
  - mdmbox-secret # Contains MDMBOX_LICENSE

config:
  MDMBOX_AIDBOX_APP_ENDPOINT_URL: http://mdmbox:3000/api/aidbox-app-proxy

replicaCount: 1
autoscaling:
  enabled: false
updateStrategy:
  type: Recreate
  rollingUpdate: null
```

Set `MDMBOX_AIDBOX_APP_ENDPOINT_URL` to the MDMbox Service URL that Aidbox can reach; adjust the Service name and port when your release uses different values. Open the UI at `/mdmbox` on the Aidbox public address.

Put non-secret MDMbox settings, such as connection pool sizes, under `config:`. If `BOX_WEB_BASE_URL` is absent from your existing Aidbox ConfigMap, add it there or supply the same address as `config.BOX_WEB_BASE_URL`. The legacy `AIDBOX_BASE_URL` is also supported. Use `extraEnvFromSecrets` for the MDMbox license and credentials.

## Install MDMbox

Create `mdmbox-secret` with `MDMBOX_LICENSE` and install MDMbox in the same namespace as these ConfigMaps and Secrets. The example uses namespace `aidbox`; replace it with yours.

```bash
helm repo add healthsamurai https://healthsamurai.github.io/helm-charts
helm repo update

helm upgrade --install mdmbox healthsamurai/mdmbox \
  --namespace aidbox \
  --values values.yaml
```

The full list of values is in the [chart README](https://github.com/HealthSamurai/helm-charts/blob/main/mdmbox/README.md). See [Authentication](../authentication.md) to configure API and browser access, and [Updating MDMbox](updating-mdmbox.md#kubernetes) for upgrade behavior.
