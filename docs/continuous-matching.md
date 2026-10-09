---
description: Keep matching newly inserted records with a persistent continuous matching process.
---

# Continuous matching

A continuous matching process finds duplicate pairs in existing data and keeps processing new records. It uses a [BulkMatchingModel](matching-models.md#bulkmatchingmodel) to prepare the comparison data, score pairs, and save those reaching the model's `probable` threshold. Each model has one process and one accumulated result set. Matching does not automatically merge records.

{% hint style="warning" %}
Continuous matching captures **new inserts**. To include updates and deletions, pause, reset, and start the process again.
{% endhint %}

For a job that finishes after processing a prepared dataset, use [Bulk matching](bulk-match.md).

## Start and pause

1. Open **Matching → Continuous matching** at `/mdmbox/admin/continuous-match` on the Aidbox address.
2. Select a model. Optionally adjust workers, batch size, and batch wait time under **Run settings**.
3. Choose **Start**. MDMbox prepares the data, matches existing records, then keeps matching new inserts.
4. Choose **Download CSV** to review accumulated pairs, or **Pause** to suspend processing.

A full batch is processed as soon as it is available. Smaller batches wait for the configured batch wait time, so a single new record can be processed too.

Pause keeps completed results. New inserts continue to be captured and wait for **Resume**. Interrupted batches are recomputed after resuming; they do not consume a retry attempt. Pausing during the initial build cancels that build and returns the process to idle.

Run settings are editable only while the process is inactive. Use [Reset](#reset-and-delete) to discard progress and results.

## Monitor activity

Process status and activity update automatically. Matching continues when you leave the page.

The overview shows preparation, catch-up, batch collection, and waiting for new records. Progress reaches 100% when the current queue is clear; the process keeps running and the total grows with new inserts. **Workers matching** shows busy workers, and **Pairs found** shows accumulated results.

**Recent batch activity** shows matching batches in blue, completed batches in green, and failed batches in red. Select a batch to inspect its size, duration, and failed attempts. **Timeout batch** identifies a batch processed after the configured wait time.

Open **Diagnostics** to review model versions, capture errors, and batch history. Filter history by status to find failed batches.

## Model versions and restarts

An active process keeps the model version it started with. Saving the model does not change a running process's data or scoring rules. The UI shows **Model in use** and **Latest model** when they differ.

To apply a saved change, pause the process and choose **Rebuild**. This rebuilds the prepared data (the projection) and recomputes its pairs. Starting an unchanged paused process resumes its pending work and keeps existing pairs.

After an application restart, active processes resume automatically with their saved model version; interrupted builds restart. Keep that version in FHIR history. Paused and failed processes require manual action to resume.

### Deployment and upgrades

Each model has one matching owner at a time. During a rolling update, the old instance continues matching while its replacement becomes ready to serve API and admin UI requests. After the old instance stops, another instance automatically resumes matching with its saved model version and accumulated results.

Use the following Helm configuration for rolling updates:

```yaml
updateStrategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
```

Matching briefly pauses during handover while new inserts continue to be captured. Start, Pause, status, and results are available through either instance. Pause is asynchronous: wait for `paused` (or `idle` when cancelling preparation) before resetting or rebuilding.

Allow enough termination grace time for workers to stop. Interrupted batches are recomputed after recovery. Size PostgreSQL connections for all instances, including additional pods during an update. When scaling down, the remaining instances need enough bulk pool capacity to resume active processes. See [connection pool sizing](config-reference.md#mdmbox-connection-pools).

## Results and failures

**Download CSV** exports all accumulated pairs using the same [columns as Bulk matching](bulk-match.md#step-3-download-results).

When downloading through Aidbox, follow the [App integration version recommendation](deployment/versions-and-compatibility.md#aidbox-app-integration) for streaming large exports.

Decision status is evaluated at download time. Results still use the process's saved model version, even if you have since edited the model. Missing model history causes an HTTP 500 OperationOutcome before the export starts.

A failed batch is retried after five seconds, up to three failed attempts. **Retry** gives failed batches a fresh attempt budget. Interrupted batches do not leave partial results.

If a new record cannot be prepared for matching, its original write still succeeds, but the record is missing from matching results. Review capture errors, fix the cause, then pause, reset, and start again to include those records.

## Reset and delete

Pause the process and choose **Reset matching**. Reset deletes results, progress, errors, and prepared data, and stops capturing inserts. It keeps the model and source records. **Start** then builds everything again.

Deleting a paused BulkMatchingModel also deletes its process and results. Pause before deleting: resetting an active process returns HTTP 409, and deleting its model through FHIR returns HTTP 412.

## API

All process endpoints use the same [API authentication](authentication.md) as other MDMbox operations. The `/api/*` paths are available directly on MDMbox or through `App/mdmbox` on Aidbox. When `MDMBOX_API_AIDBOX_APP_ONLY=true`, use the Aidbox host and grant access with Aidbox AccessPolicies.

| Method | Path | Result |
| --- | --- | --- |
| POST | `/api/continuous-match/{model-id}/start` | 202 when starting or resuming; 200 if already active on either instance; 400 for invalid settings; 409 if another operation owns the model, the instance is shutting down, or the pool has insufficient capacity |
| POST | `/api/continuous-match/{model-id}/pause` | 202 when Pause is accepted for either instance; 409 if the process is not active |
| POST | `/api/continuous-match/{model-id}/retry` | 200 with the number of requeued failed intervals |
| GET | `/api/continuous-match/{model-id}/status` | FHIR Parameters with process state, model versions, settings and counts |
| GET | `/api/continuous-match/{model-id}/result` | Accumulated pairs as NDJSON (default), CSV, or paginated JSON; optional `decisionStatus` filter |
| DELETE | `/api/continuous-match/{model-id}` | 200 after Reset; 409 while the process is active or another operation owns it |

A missing model on Start, or a missing process on the other operations, returns 404. Commands and status return FHIR `Parameters` as JSON; errors use `OperationOutcome`. Read parameters by `name`, independently of their order. For example, the first Start returns HTTP 202:

```json
{
  "resourceType": "Parameters",
  "parameter": [
    { "name": "mode", "valueCode": "continuous" },
    { "name": "model", "valueReference": { "reference": "BulkMatchingModel/patient-bulk" } },
    { "name": "status", "valueCode": "building" },
    { "name": "rebuild", "valueBoolean": true }
  ]
}
```

Every command response includes `mode` and `model`, plus these parameters:

| Command | Response parameters |
| --- | --- |
| Start / Resume | `status` and `rebuild`; a resumed process returns `running` and `false` |
| Pause | `status: pausing` (`cancelling` during preparation); `cancelled` (`valueDecimal`) counts immediately cancelled sessions and can be zero while the owner handles Pause asynchronously |
| Retry | `requeued` (`valueDecimal`), the number of failed batches queued again |
| Reset | `status: deleted` |

Repeating Start for an active process returns HTTP 200 and keeps its settings. If Pause is pending, wait for it to finish before resuming.

Poll progress with:

```http
GET https://<mdmbox-host>/api/continuous-match/patient-bulk/status
```

Status uses the same [parameter names and progress shape as Bulk matching](bulk-match.md#step-2-monitor-progress). Here `mode` is `continuous`, and there is no job ID: the model identifies the process. Possible states are `idle`, `building`, `running`, `pausing`, `paused`, and `failed`. A continuous process stays `running` while waiting for new records; it does not reach `completed`.

`progress` contains batch counts (`pending`, `running`, `completed`, `failed`, `total`). `pairs` is the accumulated pair count, available while running too. `errors` counts capture errors, failed batches, and a process-level failure if present; `captureErrors` isolates records that could not be prepared. Check these counts even while the process is running.

Additional status parameters:

| Parameter | FHIR value | Meaning |
| --- | --- | --- |
| `stage`, `error` | `valueCode`, `valueString` | Current build step or process-level failure; omitted when absent |
| `runningHere`, `triggerInstalled` | `valueBoolean` | Whether this instance owns the process and whether insert capture is installed |
| `statusChangedAt` | `valueDateTime` | Last lifecycle change |
| `projection` | `part` | `exists` (`valueBoolean`), `unassigned` and optional `oldestUnassignedMs` (`valueDecimal`) |
| `settings` | `part` | Saved `workersCount`, `batchSize`, `cutTimeoutMs`, `cutPollMs`, `claimPollMs`, `maxAttempts`, each with `valueInteger` |

`modelVersion`, `currentModelVersion`, and `modelChanged` show whether a saved model change needs a rebuild. Counters use whole-number `valueDecimal` values, as in Bulk matching.

Export results using `Accept`:

```http
GET https://<mdmbox-host>/api/continuous-match/patient-bulk/result?decisionStatus=pending
Accept: application/x-ndjson
```

Use `Accept: text/csv` to download CSV. Without `Accept`, the default is NDJSON. All three formats support `decisionStatus=pending|linked|merged|not-a-match`; omit it for all pairs. An unsupported format returns HTTP 406 OperationOutcome, an invalid filter returns 400. Each NDJSON line has `resourceId1`, `resourceId2`, `matchWeight`, `matchDetails`, and `decisionStatus`, as in [Bulk matching results](bulk-match.md#step-3-download-results).

To browse results a page at a time, request `application/json`:

```http
GET https://<mdmbox-host>/api/continuous-match/patient-bulk/result?decisionStatus=pending&_count=100&_page=0
Accept: application/json
```

```json
{
  "entries": [
    {
      "resourceId1": "patient-1",
      "resourceId2": "patient-2",
      "matchWeight": 18.0,
      "matchDetails": { "dob": 10.0, "family": 8.0 },
      "decisionStatus": "pending"
    }
  ],
  "total": 1
}
```

`entries` uses the same pair fields and decision values as NDJSON. `total` is the number of pairs matching the model and decision filter before pagination, including when the requested page is empty. No matches returns `{"entries":[],"total":0}`.

| Parameter | Meaning | Default |
| --- | --- | --- |
| `_count` | Maximum entries per JSON page, an integer from 0 to 1000. Use 0 to return only `total` with an empty `entries` array. | 100 |
| `_page` | Zero-based page number, a nonnegative integer. Page 0 is the first page. | 0 |

Each parameter can be omitted independently. Invalid pagination, including values too large to calculate the requested page, returns HTTP 400 OperationOutcome. CSV and NDJSON return all matching pairs; pagination limits apply only to JSON.

JSON pages sort by descending `matchWeight`, then ascending `resourceId1` and `resourceId2` to keep equally weighted pairs in a stable order. Results and decisions remain live: inserts or decision changes between requests can shift page boundaries and change `total`. Pagination does not preserve a snapshot across requests; use CSV or NDJSON for a complete export in one request.

Start accepts a settings object. For example:

```http
POST https://<mdmbox-host>/api/continuous-match/patient-bulk/start
Content-Type: application/json
```

```json
{
  "workersCount": 4,
  "batchSize": 1000,
  "cutTimeoutMs": 2000
}
```

| Setting | Meaning | Default |
| --- | --- | --- |
| `workersCount` | Parallel matching workers | 4 |
| `batchSize` | Records per batch | 1000 |
| `cutTimeoutMs` | Wait before assigning a partially filled batch, in milliseconds | 2000 |

Each setting must be an integer from 1 to 2147483647. Invalid values return HTTP 400 without changing the process. Omitted settings use the defaults on an explicit Start; automatic recovery uses saved settings. Start on an already active process keeps its settings regardless of which instance receives the request.

## Connection capacity

Bulk matching uses a separate database pool controlled by `MDMBOX_BULK_DB_*`. Each process reserves `workersCount + 1` connections, including one for its coordinator. Start returns 409 when that reservation and active bulk job or continuous process reservations exceed `MDMBOX_BULK_DB_MAX_POOL_SIZE`. Pause another process, reduce the worker count or increase the bulk pool size before retrying. See [Configuration reference](config-reference.md#mdmbox-connection-pools).

## Current limitations

- Recreating a deleted resource with the same ID retains its old prepared values until a rebuild.
- Results are an accumulated set, optionally filtered by decision status, rather than a stream of changes.
- Pause keeps the sync trigger active. Use Reset or delete the paused model to remove it.
- A missing sync trigger is reported in the status and UI, but does not automatically fail the process. Pause, reset and start the process to rebuild it.

Commands, status requests, and exports are [audited](audit.md#bulk-operation-codes). If the required audit event cannot be saved, the command or export does not start.
