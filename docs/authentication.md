---
description: Authenticate MDMbox API requests and Admin UI sessions.
---

# Authentication

Authentication is enabled by default and is controlled by `MDMBOX_AUTH_ENABLED`. MDMbox supports separate authentication flows for API requests and the Admin UI.

| Interface | Authentication |
| --- | --- |
| API | Basic credentials for an Aidbox `Client`, an Aidbox access token, or an external JWT validated by `TokenIntrospector` |
| Admin UI | Aidbox browser session and Aidbox `AccessPolicy`, forwarded through `App/mdmbox` |

When direct API access is enabled, every authenticated credential has full access to protected API endpoints on MDMbox. Requests through Aidbox are subject to its AccessPolicies. Set `MDMBOX_API_AIDBOX_APP_ONLY=true` to require that route for protected API operations. UI permissions are always evaluated by Aidbox.

## Basic API authentication

Set both variables to create credentials for API access:

```bash
MDMBOX_API_CLIENT_ID=mdmbox-api
MDMBOX_API_CLIENT_SECRET=<secret>
```

Send the client credentials through HTTP Basic authentication:

```bash
curl --user "mdmbox-api:$MDMBOX_API_CLIENT_SECRET" \
  http://localhost:3000/api/models
```

## Admin UI through Aidbox

Open `/mdmbox` on the Aidbox address, for example `http://localhost:8888/mdmbox`. If you are not signed in, the browser redirects to Aidbox login and returns to the requested page after sign-in. MDMbox uses the identity admitted by Aidbox and requires no separate UI role, login, or browser cookie. Direct UI requests to MDMbox return HTTP 403.

For CSV exports and incremental UI updates, follow the [Aidbox App version recommendation](deployment/versions-and-compatibility.md#aidbox-app-integration).

At startup, MDMbox registers `App/mdmbox` and its UI and API operations in Aidbox. Set the address Aidbox uses to reach MDMbox:

```bash
MDMBOX_AIDBOX_APP_ENDPOINT_URL=http://mdmbox:3000/api/aidbox-app-proxy
```

The value above is the default for Docker Compose. For Kubernetes, use the MDMbox Service address. The App endpoint secret is generated once and retained across restarts.

The startup seed also creates `AccessPolicy/mdmbox-ui-login`. It permits anonymous HTML GET requests to the UI only to return the login redirect; it grants no access to page content, API operations, or UI mutations. Authenticated users still need a UI AccessPolicy. Requests for JSON or SSE retain Aidbox's authentication errors.

To create an initial UI administrator, set both variables:

```bash
MDMBOX_ADMIN_ID=admin
MDMBOX_ADMIN_PASSWORD=<password>
```

MDMbox creates the Aidbox `User` and `AccessPolicy/mdmbox-ui-admin-admin`, granting that user access to `/mdmbox` and its subpaths. Existing policies are preserved on restart. Without these variables, grant access to an existing Aidbox user through an [Aidbox AccessPolicy](https://www.health-samurai.io/docs/aidbox/access-control/authorization/access-policies). Existing global Aidbox policies also apply.

`MDMBOX_ADMIN_ROLE` is no longer used. Existing roles and `Client/mdmbox-ui` are not removed, but MDMbox no longer uses or creates them. Sign-in and sign-out use Aidbox's authentication and audit facilities; MDMbox [audits UI operations](audit.md) with the verified identity forwarded by Aidbox.

`MDMBOX_AUTH_ENABLED=false` disables the requirement for a forwarded principal, but direct UI access remains forbidden and App credentials are still verified. Anonymous HTML navigation still redirects to Aidbox login.

## API through Aidbox

The startup App exposes API operations on Aidbox at the same `/api/*` paths as MDMbox. Configure Aidbox AccessPolicies for those operations. Set `MDMBOX_API_AIDBOX_APP_ONLY=true` to reject direct protected API calls with HTTP 403 and enforce the Aidbox policies. MDMbox verifies the App endpoint credentials and uses the principal Aidbox authenticated, without checking the caller's forwarded Authorization header again. Swagger and `/api/openapi.json` remain public.

The [Aidbox App example](https://github.com/HealthSamurai/mdmbox-playground/tree/main/examples/aidbox-app) also shows how to publish `$match` at Aidbox's FHIR endpoint using a separate App.

## External JWT authentication

Configure token validation using the [Aidbox Token Introspector documentation](https://www.health-samurai.io/docs/aidbox/access-control/authentication/token-introspector), then send the token to MDMbox:

```bash
curl http://localhost:3000/api/models \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

For a runnable setup, see the [Keycloak authentication example](https://github.com/HealthSamurai/mdmbox-playground/tree/main/examples/token-introspector-without-user). For existing users, clients, and sessions, see [Aidbox authentication](https://www.health-samurai.io/docs/aidbox/access-control/authentication).

## Public endpoints

The health checks, Swagger UI, and OpenAPI specification remain public when authentication is enabled:

- `/healthz`
- `/readyz`
- `/api/docs`
- `/api/openapi.json`

## Related pages

- [Audit](audit.md) — how verified users, JWT subjects, and clients are recorded as operation initiators
- [Getting started](getting-started.md)
- [Configuration reference](config-reference.md)
- [API reference](api-reference.md)
