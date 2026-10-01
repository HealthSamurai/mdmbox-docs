---
description: Authenticate MDMbox API requests and Admin UI sessions.
---

# Authentication

Authentication is enabled by default and is controlled by `MDMBOX_AUTH_ENABLED`. MDMbox supports separate authentication flows for API requests and the Admin UI.

| Interface | Authentication |
| --- | --- |
| API | Basic credentials for an Aidbox `Client`, an Aidbox access token, or an external JWT validated by `TokenIntrospector` |
| Admin UI | Aidbox browser session backed by an Aidbox `User` |

Every authenticated credential has full access to protected MDMbox endpoints.

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

## Admin UI authentication

Set both variables to create an admin for browser login:

```bash
MDMBOX_ADMIN_ID=admin
MDMBOX_ADMIN_PASSWORD=<password>
```

Use these credentials to sign in at `/login`.

Login and logout are [audited](audit.md).

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
