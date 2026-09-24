---
description: Complete list of MDMbox REST API endpoints.
---

# API reference

All paths below use the MDMbox host. Use [API authentication](authentication.md) for protected endpoints. General FHIR resource CRUD and search use the separate Aidbox host at `/fhir`.

Open `/api/docs` for Swagger UI or `/api/openapi.json` for the full specification and request schemas. The specification reports the running image version.

The `mdm` helpers supplied to server-side scripts are documented separately in the [JavaScript algorithm API](javascript-algorithm-api.md).

## Infrastructure

| Method | Path                | Description           |
| ------ | ------------------- | --------------------- |
| `GET`  | `/healthz`          | Liveness check        |
| `GET`  | `/readyz`           | Readiness check       |
| `GET`  | `/api/docs`         | Swagger UI            |
| `GET`  | `/api/openapi.json` | OpenAPI specification |

`/readyz` returns HTTP 200 when ready, otherwise 503. Its JSON body contains `status` and the individual `checks.db` and `checks.fhir` results.

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
| `POST` | `/api/fhir/$merge/v2`   | Server-managed merge  |
| `POST` | `/api/fhir/$unmerge/v2` | Server-managed unmerge |
| `POST` | `/api/fhir/$merge`   | Client-plan merge                           |
| `POST` | `/api/fhir/$unmerge` | Client-plan unmerge |

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

See [Mark not a match](mark-not-a-match.md) for the request, response, and effect on matching and merging.

### $referencing

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/fhir/:resource/:id/$referencing` | Find resources referencing a given resource |

See [Referencing operation](referencing-operation.md).

## Matching

### Bulk matching

All bulk match endpoints are scoped to a BulkMatchingModel by ID.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/bulk-match/:model-id/status` | Get preparation state and active or latest non-archived job progress |
| `GET` | `/api/bulk-match/:model-id/status/:job-id` | Get a specific job's progress, including archived jobs |
| `POST` | `/api/bulk-match/:model-id/start` | Prepare data if needed and start a job (body: `{batchSize, workersCount, refreshSourceData}`) |
| `POST` | `/api/bulk-match/:model-id/stop` | Stop job (`?force=true` for immediate cancellation) |
| `POST` | `/api/bulk-match/:model-id/continue` | Resume a stopped job |
| `POST` | `/api/bulk-match/:model-id/archive` | Archive a completed or stopped job |
| `GET` | `/api/bulk-match/:model-id/result` | Export the latest completed or stopped job |
| `GET` | `/api/bulk-match/:model-id/result/:job-id` | Export a specific job of this model |

Commands and status return FHIR `Parameters`; errors use `OperationOutcome`. Both result routes accept `Accept: text/csv` or `Accept: application/x-ndjson` (default), and an optional `decisionStatus` filter. See [Bulk matching](bulk-match.md).

### Continuous matching

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/continuous-match/:model-id/start` | Start, resume, or rebuild after a model change |
| `POST` | `/api/continuous-match/:model-id/pause` | Pause while keeping progress and results |
| `POST` | `/api/continuous-match/:model-id/retry` | Requeue failed batches |
| `GET` | `/api/continuous-match/:model-id/status` | Get process status and counts |
| `GET` | `/api/continuous-match/:model-id/result` | Export accumulated pairs |
| `DELETE` | `/api/continuous-match/:model-id` | Reset a paused process, keeping the model and source records |

Commands and status return FHIR `Parameters`, using the same progress fields as Bulk matching; errors use `OperationOutcome`. Results support the same CSV/NDJSON formats and decision filters as Bulk matching. See [Continuous matching](continuous-matching.md) for settings and operating limits.

## Admin UI

The admin interface is available at `/admin`. It provides:

- `/admin` — model management (create, edit, delete MatchingModel and BulkMatchingModel)
- `/admin/bulk-match` — Bulk matching (start, monitor, download, stop)
- `/admin/continuous-match` — Continuous matching (start, pause, retry, download, reset)

The **Algorithms** section manages merge and unmerge scripts and their Git sources. See [Algorithm management](algorithms.md).

The Admin UI uses server-sent events for real-time updates. No separate frontend deployment is required.
