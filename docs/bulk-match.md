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

## API workflow

### Step 1: Prepare the flat table

```http
POST /api/bulk-match/patient-bulk/prepare
```

This creates the flat table, populates it from FHIR resources, and creates indexes. The operation runs asynchronously. Poll the status endpoint to track progress:

```http
GET /api/bulk-match/patient-bulk/status
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
POST /api/bulk-match/patient-bulk/prepare?force=true
```

### Step 2: Start the bulk match

```http
POST /api/bulk-match/patient-bulk/start
Content-Type: application/json
```

```json
{
  "batchSize": 1000,
  "workersCount": 4
}
```

- `batchSize` -- number of records per worker batch (100 to 10000)
- `workersCount` -- number of parallel workers (1 to 16)

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
GET /api/bulk-match/patient-bulk/download/{job-id}
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
POST /api/bulk-match/patient-bulk/stop
```

Workers finish their current batch and exit. For immediate cancellation:

```http
POST /api/bulk-match/patient-bulk/stop?force=true
```

### Resume a stopped job

```http
POST /api/bulk-match/patient-bulk/continue
```

Resumes from where it left off -- completed batches are not reprocessed.

### Archive a job

```http
POST /api/bulk-match/patient-bulk/archive
```

Moves a completed, stopped, or failed job to archived status.

## Performance considerations

- **Batch size** affects memory usage per worker. Larger batches reduce overhead but use more memory.
- **Worker count** should not exceed available CPU cores or database connections.
- The flat table uses PostgreSQL unlogged tables (no WAL overhead) for faster writes.
- Indexes on block columns are critical -- without them, the comparison query does a full cross-join.

{% hint style="warning" %}
Each bulk match worker holds a database connection for the duration of its work. Make sure `MDMBOX_DB_MAX_POOL_SIZE` is large enough to accommodate the number of workers plus normal application traffic.
{% endhint %}
