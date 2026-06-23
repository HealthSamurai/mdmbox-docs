---
description: Complete list of MDMbox REST API endpoints.
---

# API reference

The full OpenAPI specification is available at `/api/openapi.json`. The interactive Swagger UI is at `/api/docs`.

## Infrastructure

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/healthz` | Liveness check |
| `GET` | `/readyz` | Readiness check (database and FHIR engine) |
| `GET` | `/api/docs` | Swagger UI |
| `GET` | `/api/openapi.json` | OpenAPI specification |

## Matching models

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/models` | List all models (optional `?resource=Patient`) |
| `POST` | `/api/models` | Create a model |
| `GET` | `/api/models/:id` | Get model by ID |
| `PUT` | `/api/models/:id` | Update model |
| `DELETE` | `/api/models/:id` | Delete model |

Both MatchingModel and BulkMatchingModel are managed through this endpoint. The `resourceType` field in the request body determines the type.

## Users and clients

`User` and `Client` resources can be managed through the IAM endpoints. These
endpoints require normal API authentication. MDMbox currently has no role split,
so any valid authenticated `User` or `Client` can call them. Responses omit
`User.password` and `Client.secret`.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/iam/User` | List users |
| `POST` | `/api/iam/User` | Create user |
| `GET` | `/api/iam/User/:id` | Get user by ID |
| `PUT` | `/api/iam/User/:id` | Update user |
| `PATCH` | `/api/iam/User/:id` | Patch user |
| `DELETE` | `/api/iam/User/:id` | Delete user |
| `GET` | `/api/iam/Client` | List clients |
| `POST` | `/api/iam/Client` | Create client |
| `GET` | `/api/iam/Client/:id` | Get client by ID |
| `PUT` | `/api/iam/Client/:id` | Update client |
| `PATCH` | `/api/iam/Client/:id` | Patch client |
| `DELETE` | `/api/iam/Client/:id` | Delete client |

## FHIR operations

### $match

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/fhir/:resource/$match` | Match a resource (FHIR Parameters body) |
| `POST` | `/api/fhir/:resource/:id/$match` | Match existing resource by ID |

See [Find duplicates: $match](match-operation.md).

### $merge

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/$merge` | Execute or preview a merge |

See [Merge operation](merge-operation.md).

### $referencing

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/fhir/:resource/:id/$referencing` | Find resources referencing a given resource |

See [Referencing operation](referencing-operation.md).

## Bulk matching

All bulk match endpoints are scoped to a BulkMatchingModel by ID.

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/bulk-match/:model-id/prepare` | Prepare flat table (`?force=true` to recreate) |
| `GET` | `/api/bulk-match/:model-id/status` | Get flat table preparation status |
| `POST` | `/api/bulk-match/:model-id/start` | Start bulk match job (body: `{batchSize, workersCount}`) |
| `POST` | `/api/bulk-match/:model-id/stop` | Stop job (`?force=true` for immediate cancellation) |
| `POST` | `/api/bulk-match/:model-id/continue` | Resume a stopped job |
| `POST` | `/api/bulk-match/:model-id/archive` | Archive a completed or stopped job |
| `GET` | `/api/bulk-match/:model-id/download/:job-id` | Download results as CSV |

See [Bulk matching](bulk-match.md).

## Admin UI

The admin interface is available at `/admin`. It provides:

- `/admin` — model management (create, edit, delete MatchingModel and BulkMatchingModel)
- `/admin/bulk-match` — bulk match pipeline (prepare, start, monitor, download, stop)

The Admin UI uses server-sent events for real-time updates. No separate frontend deployment is required.
