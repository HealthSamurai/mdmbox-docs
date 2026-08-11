---
description: Run bulk matching to find all duplicate pairs across large datasets using parallel workers.
---

# Bulk matching

Bulk matching finds all duplicate pairs across an entire dataset. Unlike `$match` which compares one resource at a time, bulk matching compares every record against every other record in parallel.

{% hint style="warning" %}
Bulk matching requires a BulkMatchingModel. See [Matching models](matching-models.md).
{% endhint %}

## How it works

The bulk match pipeline has three stages:

```mermaid
graph LR
    A(Prepare):::blue2 --> B(Match):::green2 --> C(Download):::violet2
```

**Prepare.** MDMbox creates a flat PostgreSQL table from FHIR resources using the column definitions in your BulkMatchingModel. This extracts and denormalizes the data needed for comparison, then creates indexes.

**Match.** Parallel workers compare records in batches. Each worker claims a batch, runs the comparison query, and writes matching pairs to the results table. Workers use `FOR UPDATE SKIP LOCKED` for lock-free distribution.

**Download.** Results are streamed as CSV using PostgreSQL's COPY protocol for efficient transfer.

## Admin UI

The Admin UI at `/admin/bulk-match` is the recommended way to run bulk matching. It provides a visual interface for the entire pipeline:

- Select a BulkMatchingModel from the dropdown
- View flat table status and trigger preparation
- Configure and start bulk match jobs
- Monitor worker progress in real time
- Download results as CSV
- Stop, resume, or archive jobs

The fault-tolerant runtime is available at `/admin/bulk-match2`. It uses the
same prepared flat table and matching model, but adds durable attempts, leased
batches, automatic retry, and an error journal.

## Fault-tolerant runtime

Use the `/api/bulk-match2/:model-id` endpoints when a job must survive worker
failure or an application restart. Prepare the model first through the regular
`/api/bulk-match/:model-id/prepare` endpoint.

The runtime provides these guarantees:

- A job pins the model version and the immutable flat-table generation that
  existed when it started. Re-preparing the same model cannot change the data
  seen by a stopped job when it resumes.
- At most one active job exists for a particular model ID and model version.
  Different immutable versions may run independently.
- Workers commit a result batch and its progress marker in one transaction.
  Every lease has a token and an increasing epoch, so a stale worker cannot
  commit after reassignment or force-stop.
- Transient database failures are recorded and retried up to three times. A
  non-transient failure, or the next failure after retry exhaustion, fails the
  job and cancels unfinished batches.
- CSV download is allowed only after both the job and its current attempt are
  sealed as `completed` or `stopped`. Streaming failures are added to the job's
  error journal.

The job endpoints use the same operation names as the regular runtime:

```http
POST /api/bulk-match2/:model-id/start
POST /api/bulk-match2/:model-id/stop
POST /api/bulk-match2/:model-id/stop?force=true
POST /api/bulk-match2/:model-id/continue
GET  /api/bulk-match2/:model-id/status
GET  /api/bulk-match2/:model-id/download/:job-id
POST /api/bulk-match2/:model-id/archive
```

## Session-bound runtime (v3)

Bulk match v3 is an independent API for deployments with multiple MDMbox
instances. It does not use the prepared tables, jobs, leases, or result rows of
the earlier runtimes.

Each job creates a fixed number of global worker slots. Instances compete for
those slots through PostgreSQL session advisory locks, so `workersCount` is the
limit across all instances processing that job, not a per-instance multiplier.
Intervals still run in parallel on separate database connections. If a process
or connection disappears, PostgreSQL rolls back its current interval and
releases its slot for another instance.

V3 does not use heartbeat-based leases. A result interval, its progress marker,
and the final attempt-fence check commit in one database transaction. Force
stop changes the durable fence before best-effort backend cancellation, so an
old transaction cannot commit after stop or resume. Server-side statement and
idle-transaction timeouts bound stuck SQL and idle transactions. The protocol
does not promise bounded takeover from a PostgreSQL session that stays alive
forever outside either timeout; that stronger requirement would need an
expiring lease and a monotonic lease epoch.

Preparation creates an immutable, internally named generation and ignores the
model's `tableName` for DDL. Publishing the current-generation pointer happens
only after the table is complete. A preparation whose MDMbox process died can
be reclaimed by another request without exposing its partial table. V3 uses
WAL-logged generation tables so PostgreSQL crash recovery does not empty a
snapshot whose metadata is still ready.

V3 is API-only; it is not wired to the `/admin/bulk-match` or
`/admin/bulk-match2` pages.

### V3 endpoints

All job operations require an explicit model ID and job ID. Downloads also
require the sealed attempt ID, so a stopped attempt remains reproducibly
downloadable after the job is resumed.

```http
POST /api/bulk-match3/:model-id/prepare
POST /api/bulk-match3/:model-id/prepare?force=true
GET  /api/bulk-match3/:model-id/preparation

POST /api/bulk-match3/:model-id/start
GET  /api/bulk-match3/:model-id/jobs/:job-id/status
POST /api/bulk-match3/:model-id/jobs/:job-id/stop
POST /api/bulk-match3/:model-id/jobs/:job-id/stop?force=true
POST /api/bulk-match3/:model-id/jobs/:job-id/continue
POST /api/bulk-match3/:model-id/jobs/:job-id/archive
GET  /api/bulk-match3/:model-id/jobs/:job-id/attempts/:attempt-id/download
```

Preparation runs on a bounded, per-instance maintenance queue. Repeating the
same request while its generation is already queued or running is idempotent:
it does not add another task. If the queue is full, prepare returns `503`; the
durable `preparing` claim remains available for a later retry.

The preparation status response contains both `current` and `latest`.
`current` remains the last completely published generation, while `latest`
also exposes an in-progress or failed replacement. A failed occurrence has
`latest.status = "failed"` and includes `latest.error_message`; a first failed
preparation therefore returns status information instead of `404`.

Start accepts `batchSize` from 1 to 1,000,000 and `workersCount` from 1 to 16:

```json
{
  "batchSize": 1000,
  "workersCount": 4
}
```

Only one v3 job may be `running` or `stopping` for a model ID, including across
model versions. Continue is allowed only for a stopped job and always uses the
generation pinned by the original start. Download is allowed only for a
`stopped` or `completed` attempt. Archive is allowed for completed, stopped, or
failed jobs.

### V3 runtime configuration

| Variable | Default | Description |
| --- | --- | --- |
| `MDMBOX_BULK_MATCH3_POLL_INTERVAL_MS` | `100` | Dispatcher polling interval on each instance |
| `MDMBOX_BULK_MATCH3_REMOTE_SLOT_RETRY_MS` | `1000` | Base local backoff after another instance owns a worker slot; up to 25% jitter is added |
| `MDMBOX_BULK_MATCH3_MAX_LOCAL_WORKERS` | `8` | Maximum v3 worker threads on one MDMbox instance |
| `MDMBOX_BULK_MATCH3_MAX_PREPARATION_WORKERS` | `1` | Maximum concurrent preparation/GC tasks on one instance |
| `MDMBOX_BULK_MATCH3_MAX_MAINTENANCE_QUEUE_SIZE` | `64` | Maximum queued preparation/GC tasks on one instance |
| `MDMBOX_BULK_MATCH3_GENERATION_GC_INTERVAL_MS` | `60000` | Retry interval for collecting obsolete immutable generations |
| `MDMBOX_BULK_MATCH3_MAX_RETRIES` | `3` | Durable retries per interval for retryable database errors |
| `MDMBOX_BULK_MATCH3_STATEMENT_TIMEOUT_MS` | `3600000` | PostgreSQL statement timeout on worker sessions |
| `MDMBOX_BULK_MATCH3_LOCK_TIMEOUT_MS` | `30000` | PostgreSQL lock timeout on worker transactions |
| `MDMBOX_BULK_MATCH3_IDLE_TRANSACTION_TIMEOUT_MS` | `120000` | PostgreSQL idle-in-transaction timeout on worker sessions |

Each active local worker holds one database connection. Size the MDMbox pool
for `MAX_LOCAL_WORKERS`, preparation work, reconciliation, HTTP traffic, and
other application components.

Publishing a replacement immediately tries to remove obsolete generation
tables. Collection is retried when a worker session drains and periodically,
so a table temporarily retained by a live PostgreSQL session is eventually
released without another archive request.

## API workflow

### Step 1: Prepare the flat table

```http
POST https://<mdmbox-host>/api/bulk-match/patient-bulk/prepare
```

This creates the flat table, populates it from FHIR resources, and creates indexes. The operation runs asynchronously. Poll the status endpoint to track progress:

```http
GET https://<mdmbox-host>/api/bulk-match/patient-bulk/status
```

The response is an OperationOutcome. The `diagnostics` field contains preparation details as a string:

```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "information",
      "code": "informational",
      "details": {"text": "Flat table ready (150000 records)"},
      "diagnostics": "{:model-id \"patient-bulk\", :prepare-status \"ready\", :stage nil, :source-count 150000, :prepare-duration-ms 12500, :prepared-at \"2025-04-10T14:30:00Z\"}"
    }
  ]
}
```

Possible statuses: `pending`, `preparing`, `ready`, `failed`.

To force re-creation of the flat table (e.g., after data changes):

```http
POST https://<mdmbox-host>/api/bulk-match/patient-bulk/prepare?force=true
```

### Step 2: Start the bulk match

```http
POST https://<mdmbox-host>/api/bulk-match/patient-bulk/start
Content-Type: application/json
```

```json
{
  "batchSize": 1000,
  "workersCount": 4
}
```

- `batchSize` — number of records per worker batch (100 to 10000)
- `workersCount` — number of parallel workers (1 to 16)

Response (HTTP 202):

```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "information",
      "code": "informational",
      "details": {"text": "Bulk match started, job #42"},
      "diagnostics": "{:id 42, :model-id \"patient-bulk\", :status \"in-progress\"}"
    }
  ]
}
```

The job ID in `details.text` is needed for the download endpoint.

### Step 3: Monitor progress

Poll the status endpoint or use the Admin UI which auto-refreshes every 2 seconds.

### Step 4: Download results

Once the job completes:

```http
GET https://<mdmbox-host>/api/bulk-match/patient-bulk/download/{job-id}
```

Returns a CSV file with columns:

| Column | Description |
| --- | --- |
| `resource_id_1` | First resource ID |
| `resource_id_2` | Second resource ID |
| `match_weight` | Total match score |
| `{feature}_w` | Individual feature weight (one column per feature) |

## Managing jobs

### Stop a running job

```http
POST https://<mdmbox-host>/api/bulk-match/patient-bulk/stop
```

Workers finish their current batch and exit. For immediate cancellation:

```http
POST https://<mdmbox-host>/api/bulk-match/patient-bulk/stop?force=true
```

### Resume a stopped job

```http
POST https://<mdmbox-host>/api/bulk-match/patient-bulk/continue
```

Resumes from where it left off — completed batches are not reprocessed.

### Archive a job

```http
POST https://<mdmbox-host>/api/bulk-match/patient-bulk/archive
```

Moves a completed, stopped, or failed job to archived status.

## Performance considerations

- **Batch size** affects memory usage per worker. Larger batches reduce overhead but use more memory.
- **Worker count** should not exceed available CPU cores or database connections.
- The flat table uses PostgreSQL unlogged tables (no WAL overhead) for faster writes.
- Indexes on block columns are critical — without them, the comparison query does a full cross-join.

{% hint style="warning" %}
Each bulk match worker holds a database connection for the duration of its work. Make sure `MDMBOX_DB_MAX_POOL_SIZE` is large enough to accommodate the number of workers plus normal application traffic.
{% endhint %}
