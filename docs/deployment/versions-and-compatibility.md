---
description: Choose compatible MDMbox and Aidbox versions and Docker image tags.
---

# Versions and compatibility

MDMbox is compatible with Aidbox from the current LTS through the latest release, including LTS. Every MDMbox release is tested with each Aidbox monthly version in that range. MDMbox and Aidbox version numbers do not need to match.

Compatible Aidbox versions for each MDMbox monthly version are listed in [Release notes](../release-notes.md).

## Aidbox App integration

MDMbox supports serving its Admin UI and API through Aidbox. Clients use the Aidbox address: `/mdmbox` for the UI and `/api/*` for API operations. Aidbox authenticates requests, evaluates AccessPolicies, and forwards permitted requests through `App/mdmbox`, which MDMbox registers at startup.

The Admin UI is available only through Aidbox. To require the same route for all protected API operations, set `MDMBOX_API_AIDBOX_APP_ONLY=true`. Direct requests to those operations then return HTTP 403, so clients cannot bypass the AccessPolicies configured in Aidbox. Health checks and API documentation remain public. See [Authentication](../authentication.md) for access setup and [Configuration reference](../config-reference.md#authentication) for the required settings.

{% hint style="warning" %}
We recommend Aidbox `2610` or later for App integration. Response streaming is planned for `2610`; see [Release notes](../release-notes.md) for availability. Earlier supported Aidbox versions buffer each App response before sending it to the client. The UI and completed downloads still work, but intermediate UI updates arrive at the end of the request and large or concurrent bulk and continuous matching exports require enough Aidbox memory to hold their complete response bodies.
{% endhint %}

## Docker image tags

[Published MDMbox images](https://hub.docker.com/r/healthsamurai/mdmbox/tags) support Linux amd64 and arm64:

| Tag | What it selects |
| --- | --- |
| `latest` | The newest published version, including its updates. Moves forward as new versions are released. |
| `YYMM`, for example `2609` | A selected monthly version, including its updates. |
| `YYMM.N`, for example `2609.0` | An exact published release. This tag does not move. |
| `edge` | A development build. Use a released monthly version for production. |

For a local trial, use `healthsamurai/mdmbox:latest` together with `healthsamurai/aidboxone:latest`, as in [Getting started](../getting-started.md). To stay on selected monthly versions, replace `latest` in each service's `image` value with its monthly tag, keeping Aidbox within the supported range. Use exact `YYMM.N` tags when you want to select each update explicitly.

## Shared configuration

MDMbox and Aidbox run as separate services connected to the same PostgreSQL database. Use PostgreSQL 14 or later and pass the same `BOX_DB_*` and relevant `BOX_FHIR_*` settings to both services.

Set the same `BOX_WEB_BASE_URL` in both services to the public Aidbox address reachable by users and API clients. The local Docker Compose example uses `http://localhost:8888`. See [Configuration reference](../config-reference.md) for MDMbox settings and [Aidbox's settings reference](https://www.health-samurai.io/docs/aidbox/reference/all-settings) for the shared settings.

## Next steps

- [Getting started](../getting-started.md) — run a local trial.
- [Kubernetes deployment](kubernetes.md) — add MDMbox to an existing Aidbox deployment.
- [Updating MDMbox](updating-mdmbox.md) — update images or stop the local environment.
