---
description: Run bulk matching to find all duplicate pairs across large datasets using parallel workers.
---

# Batch matching

Batch matching finds duplicate pairs across a prepared dataset and finishes when the job has processed its batches. Unlike `$match`, which compares one resource at a time, it compares records across the dataset in parallel.

{% hint style="warning" %}
Bulk matching requires a BulkMatchingModel. See [Matching models](matching-models.md). For a persistent process that also matches newly inserted records, see [Continuous matching](bulk-matching-process.md).
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

Open **Bulk Match → Batch matching** in the left sidebar or go to `/admin/bulk-match`. The **Models** list shows each bulk matching model with the status of its active job, or its latest job if none is active. Models without visible jobs show **Not started**. Select a model to see its flat table, settings and job history on the right. Flat table and job statuses use the same outlined badges as other Admin UI statuses.

Prepare the **Flat table**, then expand **Run settings** to choose the worker count and batch size for a new job. Choose **Start job** in the model's toolbar. Settings default to 4 workers and a batch size of 1000 when switching models. Automatic status updates preserve edits and the expanded settings section. While a job is active for the selected model, preparation and starting another job are disabled; another model's active job does not block these controls.

The history shows up to 50 unarchived jobs for the selected model, prioritizing active jobs before recent finished jobs. Each job has its own stop, resume, CSV download and archive actions. Archiving removes a job from this history.

Worker timelines fit the available width without internal scrollbars. Green intervals completed successfully; red intervals failed. Hover over an interval for a tooltip, or select it to keep its record range, worker, duration and error visible below the graph. Use Tab to focus a timeline, then Left/Right or Home/End to inspect its intervals. Selection survives status updates. Each timeline shows the first 200 finished intervals with timing data; a note indicates when additional finished intervals are omitted.

## API workflow

Bulk commands and CSV/NDJSON downloads are [audited](audit.md#bulk-operation-codes) through both the API and Admin UI. Each command requires a durable request event before execution and records acceptance separately. Status API calls and downloads require an access event before returning data. An unavailable audit store blocks new commands and exports. Admin UI page/init, model selection, and query preview also record their results. Polling records failures only, with equivalent repeats suppressed for one minute.

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
      "details": { "text": "Flat table ready (150000 records)" },
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
      "details": { "text": "Bulk match started, job #42" },
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

| Column          | Description                                        |
| --------------- | -------------------------------------------------- |
| `resource_id_1` | First resource ID                                  |
| `resource_id_2` | Second resource ID                                 |
| `match_weight`  | Total match score                                  |
| `{feature}_w`   | Individual feature weight (one column per feature) |

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
Each bulk match worker uses a connection from the separate bulk pool. Size `MDMBOX_BULK_DB_MAX_POOL_SIZE` for the concurrent workers and any continuous matching processes; `MDMBOX_DB_MAX_POOL_SIZE` controls the main application pool. See [Configuration reference](config-reference.md#mdmbox-connection-pools).
{% endhint %}
