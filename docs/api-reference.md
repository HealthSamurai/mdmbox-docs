---
description: Complete list of MDMbox REST API endpoints.
---

# API reference

The full OpenAPI specification is available at `/api/openapi.json`. The interactive Swagger UI is at `/api/docs`.

The in-process `mdm` helpers supplied to server-side scripts are documented
separately in the [JavaScript algorithm API](javascript-algorithm-api.md).

## Infrastructure

| Method | Path                | Description           |
| ------ | ------------------- | --------------------- |
| `GET`  | `/healthz`          | Liveness check        |
| `GET`  | `/readyz`           | Readiness check       |
| `GET`  | `/api/docs`         | Swagger UI            |
| `GET`  | `/api/openapi.json` | OpenAPI specification |

## Matching models

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/models` | List all models (optional `?resource=Patient`) |
| `POST` | `/api/models` | Create a model |
| `GET` | `/api/models/:id` | Get model by ID |
| `PUT` | `/api/models/:id` | Update model |
| `DELETE` | `/api/models/:id` | Delete model |

These endpoints manage `MatchingModel` resources. Manage `BulkMatchingModel` resources through the Admin UI or the adjacent Aidbox FHIR API.

## FHIR operations

### $match

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/fhir/:resource/$match` | Match a resource (FHIR Parameters body) |
| `POST` | `/api/fhir/:resource/:id/$match` | Match existing resource by ID |
| `POST` | `/api/fhir/r4/:resource/$match` | Match a resource using the R4 operation implementation |
| `POST` | `/api/fhir/r4/:resource/:id/$match` | Match an existing resource by ID using the R4 operation implementation |
| `POST` | `/api/fhir/r6/:resource/$match` | Match a resource using the R6 operation implementation |
| `POST` | `/api/fhir/r6/:resource/:id/$match` | Match an existing resource by ID using the R6 operation implementation |

The unversioned routes use the release selected by `MDMBOX_DEFAULT_FHIR_RELEASE`.

For body-based `$match`, MDMbox validates the input `resource` before running matching. If the resource declares `meta.profile`, the referenced profile must be available in the FHIR package registry and the resource must satisfy it. Validation failures return `422 Unprocessable Entity` with an `OperationOutcome`.

See [Find duplicates: $match](match-operation.md).

### Merge lifecycle

| Method | Path                 | Description                                  |
| ------ | -------------------- | -------------------------------------------- |
| `POST` | `/api/fhir/$merge/v2`   | Compute and execute or preview a merge plan  |
| `POST` | `/api/fhir/$unmerge/v2` | Reconstruct and reverse a merge from history |
| `POST` | `/api/fhir/$merge`   | Execute or preview a merge                   |
| `POST` | `/api/fhir/$unmerge` | Reverse a previous merge from its merge Task |

See [Merge operation](merge-operation.md) and [Unmerge operation](unmerge-operation.md).

### Link lifecycle

| Method | Path                | Description                                |
| ------ | ------------------- | ------------------------------------------ |
| `POST` | `/api/fhir/$link`   | Execute or preview a link plan             |
| `POST` | `/api/fhir/$unlink` | Reverse a previous link from its link Task |

See [Link operation](link-operation.md) and [Unlink operation](unlink-operation.md).

### $mark-not-a-match

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/fhir/$mark-not-a-match` | Record that two resources are not the same real-world entity |

### $referencing

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/fhir/:resource/:id/$referencing` | Find resources referencing a given resource |

See [Referencing operation](referencing-operation.md).

## Bulk matching

### Batch matching

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

See [Batch matching](bulk-match.md).

### Continuous matching

Continuous matching processes use `/api/bulk-match-v2/:model-id`: `POST /start`, `POST /pause`, `POST /retry`, `GET /status`, `GET /pairs`, and `DELETE` on the model prefix to reset its process. See [Continuous matching](bulk-matching-process.md) for request settings, version handling and conflict responses. The established API URLs remain unchanged by the mode names used in the Admin UI.

## Admin UI

The admin interface is available at `/admin`. It provides:

- `/admin` — model management (create, edit, delete MatchingModel and BulkMatchingModel)
- `/admin/bulk-match` — Batch matching (prepare, start, monitor, download, stop)
- `/admin/bulk-match-v2` — Continuous matching (start, pause, retry, download, reset)

The Admin UI uses server-sent events for real-time updates. No separate frontend deployment is required.
