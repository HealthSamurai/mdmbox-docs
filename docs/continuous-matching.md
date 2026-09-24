---
description: Keep matching newly inserted records with a persistent continuous matching process.
---

# Continuous matching

A continuous matching process finds duplicate pairs in existing data and keeps processing new records. It uses a [BulkMatchingModel](matching-models.md#bulkmatchingmodel) to prepare the comparison data, score pairs, and save those reaching the model's `probable` threshold. Each model has one process and one accumulated result set. Matching does not automatically merge records.

{% hint style="warning" %}
Continuous matching captures **inserts only**. Updates and deletions do not refresh the prepared data or remove old pairs. To reflect those changes, pause, reset, and start the process again. Run one MDMbox instance; see [Deployment and upgrades](#deployment-and-upgrades).
{% endhint %}

For a job that finishes after processing a prepared dataset, use [Bulk matching](bulk-match.md).

## Start and pause

1. Open **Matching → Continuous matching** at `/admin/continuous-match`.
2. Select a model. Optionally adjust workers, batch size, and batch wait time under **Run settings**.
3. Choose **Start**. MDMbox prepares the data, matches existing records, then keeps matching new inserts.
4. Choose **Download CSV** to review accumulated pairs, or **Pause** to suspend processing.

A full batch is processed as soon as it is available. Smaller batches wait for the configured batch wait time, so a single new record can be processed too.

Pause keeps completed results. New inserts continue to be captured and wait for **Resume**. Interrupted batches are recomputed after resuming; they do not consume a retry attempt. Pausing during the initial build cancels that build and returns the process to idle.

Run settings are editable only while the process is inactive. Use [Reset](#reset-and-delete) to discard progress and results.

## Model versions and restarts

An active process keeps the model version it started with. Saving the model does not change a running process's data or scoring rules. The UI shows **Model in use** and **Latest model** when they differ.

To apply a saved change, pause the process and choose **Rebuild**. This rebuilds the prepared data (the projection) and recomputes its pairs. Starting an unchanged paused process resumes its pending work and keeps existing pairs.

After an application restart, active processes resume automatically; interrupted builds restart and processes left pausing finish pausing. Keep the process's saved model version in FHIR history. A process owned by another instance is left untouched.

### Deployment and upgrades

Run one MDMbox instance with autoscaling disabled when using continuous matching. Stop the old instance completely before starting its replacement. Recovery runs once at startup: a new instance that encounters the old owner's lock does not retry after the old instance exits.

Configure Helm deployments with `Recreate` so upgrades follow this order:

```yaml
replicaCount: 1
autoscaling:
  enabled: false
updateStrategy:
  type: Recreate
  rollingUpdate: null
```

Update any existing strategy overrides, including values retained by `helm upgrade --reuse-values`. Upgrades briefly interrupt the MDMbox API and admin UI while the replacement starts. Database sync triggers continue collecting inserted records during the interruption, and the replacement resumes matching them. Rolling updates with overlapping MDMbox instances are not supported for this workflow.

## Results and failures

The process card shows waiting records, batch counts, stored pairs, and errors. Expand **Diagnostics** for capture status, workers, and recent batches. **Download CSV** exports all accumulated pairs using the same [columns as Bulk matching](bulk-match.md#step-3-download-results).

Decision status is evaluated at download time. Results still use the process's saved model version, even if you have since edited the model. Missing model history causes an HTTP 500 OperationOutcome before the export starts.

A failed batch is retried after five seconds, up to three failed attempts. **Retry** gives failed batches a fresh attempt budget. Interrupted batches do not leave partial results.

If a new record cannot be prepared for matching, its original write still succeeds, but the record is missing from matching results. Review capture errors, fix the cause, then pause, reset, and start again to include those records.

## Reset and delete

Pause the process and choose **Reset matching**. Reset deletes results, progress, errors, and prepared data, and stops capturing inserts. It keeps the model and source records. **Start** then builds everything again.

Deleting a paused BulkMatchingModel also deletes its process and results. Pause before deleting: resetting an active process returns HTTP 409, and deleting its model through FHIR returns HTTP 412.

## API

All process endpoints use the MDMbox host and the same [API authentication](authentication.md) as other MDMbox operations.

| Method | Path | Result |
| --- | --- | --- |
| POST | `/api/continuous-match/{model-id}/start` | 202 when starting or resuming; 200 if already active locally; 400 for invalid settings; 409 if another operation owns the model or the pool has insufficient capacity |
| POST | `/api/continuous-match/{model-id}/pause` | 202 when pausing; 409 if the process is not active or is owned elsewhere |
| POST | `/api/continuous-match/{model-id}/retry` | 200 with the number of requeued failed intervals |
| GET | `/api/continuous-match/{model-id}/status` | FHIR Parameters with process state, model versions, settings and counts |
| GET | `/api/continuous-match/{model-id}/result` | Accumulated pairs as NDJSON (default) or CSV; optional `decisionStatus` filter |
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

A resumed process returns `status: running` and `rebuild: false`. Repeating Start for an already active local process returns HTTP 200 without changing its settings. Pause returns `status: pausing` and `cancelled` (cancelled database sessions, `valueDecimal`); Retry returns `requeued` (`valueDecimal`); Reset returns `status: deleted`. Every response includes `mode` and `model`.

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

Use `Accept: text/csv` to download CSV. Without `Accept`, the default is NDJSON. Both formats support `decisionStatus=pending|linked|merged|not-a-match`; omit it for all pairs. An unsupported format returns HTTP 406 OperationOutcome, an invalid filter returns 400. Each NDJSON line has `resourceId1`, `resourceId2`, `matchWeight`, `matchDetails`, and `decisionStatus`, as in [Bulk matching results](bulk-match.md#step-3-download-results).

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

Each setting must be an integer from 1 to 2147483647. Invalid values return HTTP 400 without changing the process. Omitted settings use the defaults on an explicit Start; automatic recovery after a restart uses saved settings. Start on an already active local process keeps its settings.

## Connection capacity

Bulk matching uses a separate database pool controlled by `MDMBOX_BULK_DB_*`. Each process reserves `workersCount + 1` connections, including one for its coordinator. Start returns 409 when that reservation and active bulk job or continuous process reservations exceed `MDMBOX_BULK_DB_MAX_POOL_SIZE`. Pause another process, reduce the worker count or increase the bulk pool size before retrying. See [Configuration reference](config-reference.md#mdmbox-connection-pools).

## Current limitations

- Recreating a deleted resource with the same ID retains its old prepared values until a rebuild.
- Results are an accumulated set, optionally filtered by decision status, rather than a stream of changes.
- Pause keeps the sync trigger active. Use Reset or delete the paused model to remove it.
- A missing sync trigger is reported in the status and UI, but does not automatically fail the process. Pause, reset and start the process to rebuild it.

Commands, status requests, and exports are [audited](audit.md#bulk-operation-codes). If the required audit event cannot be saved, the command or export does not start.
