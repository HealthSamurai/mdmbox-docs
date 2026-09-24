---
description: Run bulk matching to find all duplicate pairs across large datasets using parallel workers.
---

# Bulk matching

Bulk matching finds duplicate pairs across a prepared dataset and finishes when the job has processed its batches. Unlike `$match`, which compares one resource at a time, it compares records across the dataset in parallel.

{% hint style="warning" %}
Bulk matching requires a BulkMatchingModel. See [Matching models](matching-models.md). For a persistent process that also matches newly inserted records, see [Continuous matching](continuous-matching.md).
{% endhint %}

## How it works

The bulk match pipeline has three stages:

```mermaid
graph LR
    A(Prepare):::blue2 --> B(Match):::green2 --> C(Download):::violet2
```

**Prepare.** Start creates a snapshot of FHIR resources using the column definitions in your BulkMatchingModel, then adds indexes. Later jobs reuse that snapshot while the source and column definitions remain compatible.

**Match.** Workers process different batches in parallel and save pairs that reach the model's `probable` threshold.

**Download.** Results stream as CSV or NDJSON; the Admin UI downloads CSV.

## Admin UI

Open **Matching → Bulk matching** at `/admin/bulk-match` and select a model. Its prepared data, run settings, and job history appear on the right.

Choose **Start job**. MDMbox prepares data when needed and starts matching automatically. **Run settings** defaults to 4 workers and batches of 1000 records. Select **Refresh source data** to include records inserted, updated, or deleted since the previous preparation. A model can have one active job at a time.

**Prepared data** shows whether Start will rebuild the snapshot or only update indexes. **Prepared with model version** identifies the version used to build the snapshot; each job records the version used for its matching rules.

The history shows up to 50 unarchived jobs for the selected model, prioritizing active jobs before recent finished jobs. Each job has its own stop, resume, CSV download and archive actions. Archiving removes a job from this history.

Worker timelines show completed and failed batches. Select a batch to inspect its record range, duration, and any error. Each timeline displays up to 200 finished batches.

## API workflow

The examples use the `patient-bulk` model from [Matching models](matching-models.md#bulkmatchingmodel) and MDMbox [API authentication](authentication.md). Commands and status return FHIR `Parameters` as JSON; errors return `OperationOutcome`. Read parameters by `name`, independently of their order.

### Step 1: Start a job

```http
POST https://<mdmbox-host>/api/bulk-match/patient-bulk/start
Content-Type: application/json
```

```json
{
  "batchSize": 1000,
  "workersCount": 4,
  "refreshSourceData": false
}
```

- `batchSize` — records per worker batch; default `1000`.
- `workersCount` — parallel workers; default `4`.
- `refreshSourceData` — rebuild the snapshot from current source records; default `false`.

Each new Start uses the latest saved model. What it prepares depends on the changes:

| Change | What Start does |
| --- | --- |
| Weights, thresholds, comparison rules, or blocks | Reuses the snapshot and calculates new results with the updated rules |
| Source resource, `tableName`, column names, types, or `column.source` expressions | Rebuilds the snapshot from current source records |
| Index definitions | Updates added, changed, or removed indexes without copying source records again |
| Source records only | Reuses the snapshot; set `refreshSourceData: true` to include inserts, updates, and deletions |

For example, you can change a threshold and run Start again to compare results on the same data. The new job uses the new threshold; previous jobs keep their results and model versions. Saving a model does not alter an active job.

Start also prepares data when no usable snapshot exists, including after a PostgreSQL restart. After an upgrade, a snapshot whose compatibility cannot be verified is rebuilt on its next Start. An index-only update preserves the snapshot and its preparation date. If the index update fails or is cancelled, its changes are rolled back; fix the model or retry Start without refreshing source data.

The Admin UI offers batch sizes from 100 to 10000 and 1 to 16 workers. The API accepts integers from 1 to 2147483647 and rejects invalid settings with HTTP 400. Each active job needs `workersCount + 1` bulk connections; insufficient capacity returns HTTP 409.

Response (HTTP 202):

```json
{
  "resourceType": "Parameters",
  "parameter": [
    { "name": "mode", "valueCode": "bulk" },
    { "name": "model", "valueReference": { "reference": "BulkMatchingModel/patient-bulk" } },
    { "name": "jobId", "valueString": "42" },
    { "name": "status", "valueCode": "building" }
  ]
}
```

Save `jobId` to poll or export this job. The response arrives before preparation finishes. The job moves from `building` to `running`, then `completed`; if neither data nor indexes need preparation, it starts in `running`. A preparation error makes the job `failed`.

Repeating Start while the model has an active job returns HTTP 200 with the same `jobId`. It does not change that job's settings or refresh its source data. After the job finishes, another Start creates a new job.

### Step 2: Monitor progress

Poll the job ID returned by Start:

```http
GET https://<mdmbox-host>/api/bulk-match/patient-bulk/status/42
```

Without the job ID, `/status` selects the active job, otherwise the latest non-archived job. If the model has no such job, it returns `status: idle`. An explicit job ID can select archived history and must belong to the model; a missing model or job returns HTTP 404 OperationOutcome. An invalid job ID returns 400.

Both routes return the same parameters:

| Parameter | FHIR value | Meaning |
| --- | --- | --- |
| `mode` | `valueCode` | `bulk` |
| `model` | `valueReference` | BulkMatchingModel reference |
| `jobId` | `valueString` | Selected job ID; absent when idle |
| `status` | `valueCode` | `idle`, `building`, `running`, `pausing`, `paused`, `completed`, `failed`, or `archived` |
| `progress` | `part` | Batch counts: `pending`, `running`, `completed`, `failed`, `total`, each with `valueDecimal` |
| `pairs` | `valueDecimal` | Stored pairs; available for completed, paused, failed, and archived jobs |
| `errors` | `valueDecimal` | Failed batches plus current worker errors and a job-level failure, if any |
| `error` | `valueString` | Job-level failure message, when present |
| `liveWorkers` | `valueDecimal` | Workers currently processing batches |
| `modelVersion`, `currentModelVersion` | `valueString` | Version used by the job and latest saved version |
| `modelChanged` | `valueBoolean` | Whether those versions differ |
| `preparation` | `part` | Current preparation state of this model, even when polling an older job |

Counters use `valueDecimal` with whole-number values so they can exceed FHIR's 32-bit integer limit. Missing optional values are omitted. A completed job can contain failed batches: check `errors` and `progress.failed` before treating its results as complete.

The `preparation` parameter has a `status` part: `pending`, `preparing`, `ready`, or `failed`. While preparing, `stage` identifies the current step; `indexing` can mean an index-only update. On failure, `error` gives the reason. `sourceCount` reports the estimated snapshot size and `durationMs` reports the time spent building it; index-only updates preserve these values. A preparation failure also appears in the job's top-level `error` and sets its status to `failed`.

For example, this `progress` parameter means 8 of 10 batches have completed, one is running and one is waiting:

```json
{
  "name": "progress",
  "part": [
    { "name": "pending", "valueDecimal": 1 },
    { "name": "running", "valueDecimal": 1 },
    { "name": "completed", "valueDecimal": 8 },
    { "name": "failed", "valueDecimal": 0 },
    { "name": "total", "valueDecimal": 10 }
  ]
}
```

### Step 3: Download results

Export the latest completed or stopped job:

```http
GET https://<mdmbox-host>/api/bulk-match/patient-bulk/result
Accept: text/csv
```

To select a specific job, use `/api/bulk-match/patient-bulk/result/{job-id}`. The job must belong to the model in the URL. Both routes return HTTP 404 if there is no matching job.

Choose `Accept: application/x-ndjson` for one JSON object per line. NDJSON is also the default when `Accept` is omitted. Other unsupported formats return HTTP 406 OperationOutcome. For example:

```json
{"resourceId1":"patient-1","resourceId2":"patient-2","matchWeight":18.0,"matchDetails":{"dob":10.0,"family":8.0},"decisionStatus":"pending"}
```

Both formats stream strongest matches first. CSV has these columns:

| Column | Description |
| --- | --- |
| `resource_id_1` | First resource ID |
| `resource_id_2` | Second resource ID |
| `match_weight` | Total match score, rounded to four decimal places |
| `{feature}` | One weight column per feature, named after that feature |
| `decision_status` | `linked`, `merged`, `not-a-match`, or empty for an undecided pair |

Decisions reflect current linkage and task state at export time. NDJSON uses `pending` for undecided pairs. Filter either format with `?decisionStatus=pending`, `linked`, `merged`, or `not-a-match`; an unknown value returns HTTP 400 OperationOutcome.

## Managing jobs

### Stop a running job

```http
POST https://<mdmbox-host>/api/bulk-match/patient-bulk/stop
```

Workers finish their current batch and exit. During preparation, Stop waits for the current preparation step to finish. For immediate cancellation of matching or preparation:

```http
POST https://<mdmbox-host>/api/bulk-match/patient-bulk/stop?force=true
```

The response identifies `jobId` and reports `status: pausing`; force stop also returns `cancelled` with `valueDecimal`. Poll until the job reaches `paused`.

### Resume a stopped job

```http
POST https://<mdmbox-host>/api/bulk-match/patient-bulk/continue
```

Resumes the latest paused job using its original model version and prepared snapshot. Completed batches are not reprocessed. Jobs remain resumable after later runs that change only scoring rules or indexes, since those runs keep the same data snapshot.

If the snapshot was replaced by a later Start or PostgreSQL has restarted, Continue returns HTTP 409 with `This job's prepared data is no longer available. Start a new job.` A job stopped before batches were prepared returns 409 with `This job has no prepared batches to resume. Start a new job.` Use Start in these cases; previous results remain available by job ID.

Jobs interrupted by an MDMbox restart become `failed` and do not resume automatically. Inspect the error and use Start to retry.

### Archive a job

```http
POST https://<mdmbox-host>/api/bulk-match/patient-bulk/archive
```

Archives the most recent completed or paused job and returns its `jobId` with `status: archived`. The Admin UI can also archive a failed job. Archived jobs remain available through `/status/{job-id}` and `/result/{job-id}`.

## Performance considerations

- **Batch size** affects memory usage per worker. Larger batches reduce overhead but use more memory.
- **Worker count** should not exceed available CPU cores or database connections.
- Add indexes on columns used in blocks to keep candidate searches fast.

{% hint style="warning" %}
Each active bulk job reserves one connection per worker plus one for preparation and coordination. Size `MDMBOX_BULK_DB_MAX_POOL_SIZE` for these reservations and any continuous matching processes; `MDMBOX_DB_MAX_POOL_SIZE` controls the main application pool. See [Configuration reference](config-reference.md#mdmbox-connection-pools).
{% endhint %}

Commands, status requests, and exports are [audited](audit.md#bulk-operation-codes). If the required audit event cannot be saved, the command or export does not start.
