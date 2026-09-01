---
description: Authenticate MDMbox API requests and Admin UI sessions.
---

# Authentication

Authentication is enabled by default and is controlled by
`MDMBOX_AUTH_ENABLED`. MDMbox supports separate authentication flows for API
requests and the Admin UI.

| Interface | Authentication |
| --- | --- |
| API | Basic credentials for an Aidbox `Client`, an Aidbox access token, or an external JWT validated by `TokenIntrospector` |
| Admin UI | Aidbox browser session backed by an Aidbox `User` |

## External JWT authentication

MDMbox uses Aidbox `TokenIntrospector` resources. Configure the introspector in
Aidbox; there is no separate MDMbox configuration.

For example, a Keycloak deployment can validate RS256 tokens through its JWKS
endpoint:

```http
PUT /TokenIntrospector/keycloak
Content-Type: application/json

{
  "resourceType": "TokenIntrospector",
  "id": "keycloak",
  "type": "jwt",
  "jwt": {
    "iss": "https://keycloak.example/realms/my-realm"
  },
  "jwks_uri": "https://keycloak.example/realms/my-realm/protocol/openid-connect/certs"
}
```

The JWT issuer must exactly match `jwt.iss`. After Aidbox stores the
introspector, send the token directly to MDMbox:

```bash
curl http://localhost:3000/api/models \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

MDMbox validates the token through Aidbox's authentication pipeline.

See the Aidbox documentation for the other supported `TokenIntrospector`
configurations, including shared secrets, explicit keys, and opaque tokens:
[Token Introspector](https://www.health-samurai.io/docs/aidbox/access-control/authentication/token-introspector).

{% hint style="warning" %}
MDMbox uses Aidbox for authentication but does not evaluate Aidbox
`AccessPolicy` resources. Every successfully authenticated credential has the
same access to protected MDMbox endpoints. Restrict network access to MDMbox and
only configure trusted token issuers.
{% endhint %}

## Basic API authentication

Set both variables to bootstrap an Aidbox `Client` with the `basic` grant:

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

The Admin UI uses an Aidbox `User` and browser session. To bootstrap an admin
for browser login, set both variables:

```bash
MDMBOX_ADMIN_ID=admin
MDMBOX_ADMIN_PASSWORD=<password>
```

External JWT authentication applies to API requests only; it does not create an
Admin UI session.

## Public endpoints

The health checks, Swagger UI, and OpenAPI specification remain public when
authentication is enabled:

- `/healthz`
- `/readyz`
- `/api/docs`
- `/api/openapi.json`

## Related pages

- [Getting started](getting-started.md)
- [Configuration reference](config-reference.md)
- [API reference](api-reference.md)
