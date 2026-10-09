---
description: Update MDMbox images or stop the local Docker Compose environment.
---

# Updating MDMbox

Choose image tags using [Versions and compatibility](versions-and-compatibility.md), and check [Release notes](../release-notes.md) for changes affecting your integration.

When upgrading from `2608` to `2609`, pass the same public Aidbox `BOX_WEB_BASE_URL` to both services and set `MDMBOX_AIDBOX_APP_ENDPOINT_URL` to the MDMbox address reachable from Aidbox. Open the Admin UI through Aidbox at `/mdmbox`; direct UI access is no longer available. Grant UI access through Aidbox AccessPolicies, or set `MDMBOX_ADMIN_ID` and `MDMBOX_ADMIN_PASSWORD` to seed an initial administrator. See [Authentication](../authentication.md#admin-ui-through-aidbox) for setup.

## Docker Compose

From the directory containing the `docker-compose.yml` used in [Getting started](../getting-started.md), run:

```bash
docker compose pull
docker compose up -d
```

With `latest`, this updates both services to their latest releases. With a monthly tag, it updates within that series. To change monthly versions, edit the services' `image` values before running these commands. Keep Aidbox within MDMbox's supported range.

To stop the local environment:

```bash
docker compose down
```

This keeps the database volume, including your records, matching models, and operation history.

## Kubernetes

Update the image configuration in `values.yaml` and apply it with the same Helm command used for [installation](kubernetes.md#install-mdmbox):

```bash
helm upgrade --install mdmbox healthsamurai/mdmbox \
  --namespace aidbox \
  --values values.yaml
```

When updating within the same monthly tag, Helm may have no pod configuration change to apply. With `image.pullPolicy: Always` from the installation example, restart the deployment to pull the updated image:

```bash
kubectl rollout restart deployment/mdmbox --namespace aidbox
kubectl rollout status deployment/mdmbox --namespace aidbox
```

When using continuous matching, follow its [deployment and upgrade guidance](../continuous-matching.md#deployment-and-upgrades) for process recovery, compatible model versions, and connection capacity during replacement.
