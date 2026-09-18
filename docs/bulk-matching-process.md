---
description: Keep matching newly inserted records with a persistent bulk matching process.
---

# Continuous matching

A continuous matching process builds a projection of the records selected by a BulkMatchingModel, finds duplicate pairs, and keeps matching new records until you pause it. Each model has one process and one accumulated set of pairs. For jobs that finish after processing a prepared dataset, use [Batch matching](bulk-match.md).

## Start and pause

Start, pause, retry and reset commands, status API calls, and CSV downloads are [audited](audit.md#bulk-operation-codes). Commands require a durable request event before execution, followed by a separate acceptance event. Downloads require an access event before streaming. Admin UI page/init and model selection also record their results. Polling records failures only, with equivalent repeats suppressed for one minute.

In the left sidebar, open **Bulk Match → Continuous matching** at `/admin/bulk-match-v2`. The **Models** list shows every bulk matching model with its process status, including **Not started** for models without a process. Select a model to view its process and results on the right. **Start** and **Pause** are in the selected model's toolbar. Expand the **Run settings** heading below it to view or edit the settings.

**Run settings** contains the worker count, batch size and cut timeout. It opens automatically for an inactive process; settings are read-only while the process is active. Selecting an existing process loads its saved settings, while a model without a process uses the defaults. Status updates preserve values you are editing. The model list continues updating even when the selected model has not been started.

Process, trigger and interval statuses use the same outlined badges as other Admin UI statuses. **Running**, **Installed** and **Completed** are green; **Paused** is yellow; **Failed** and **Missing** are red; **Not started**, **Pending** and **Idle** are gray.

The first start builds the projection and its indexes. A database trigger adds each subsequently inserted source record to the projection, including inserts through the FHIR API, bulk import and SQL. Committed records are assigned to intervals; workers compare them against earlier assigned records and store pairs reaching the model's probable threshold. A full batch is assigned immediately. A smaller batch is assigned after the cut timeout, so a single new record can be matched without waiting for another full batch.

**Pause** suspends a running process, keeping its projection and committed pairs. It cancels matching statements and interval assignment, including queries waiting for database locks. Assignment ends between intervals without draining the remaining backlog. Cancelling an assignment rolls back both the projection's interval numbers and the new interval entry; those records wait for the next Start. Interrupted matching intervals return to pending without using a retry attempt. Work inside an interrupted transaction is discarded and recomputed after Start.

The sync trigger remains installed, so records inserted while the process is paused also wait for the next Start. Pausing during projection construction cancels the build, removes its objects and returns the process to idle. To remove a running process's saved data and projection, pause it and then use [Reset](#reset-and-delete).

## Model versions and restarts

An active process uses the model version from which it was built. Saving changes to the model does not change its projection or scoring rules. The page displays a warning when the saved model differs from the version in use.

To apply a saved change, pause the process and start it again. This rebuilds the projection and recomputes its pairs. Starting an unchanged paused process resumes its pending work and keeps existing pairs.

After an application restart, active processes resume automatically using their pinned FHIR model versions. Keep model history available while a process depends on it. An interrupted build is restarted; a process left pausing is marked paused, even if its saved worker settings no longer fit the bulk pool. Finishing that pause uses the main pool and still respects another instance's ownership lock. A process already owned by another instance is left untouched. Automatic leader election is not provided.

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

The process card shows its status, build stage, trigger presence, unassigned records, interval counts, stored pair count and recent errors. **Download CSV** exports the full accumulated pair set, with resource IDs, match weight, feature weights and decision status. It uses the same columns as the [job CSV](bulk-match.md#step-4-download-results). Decisions are read from current linkage and task state for the resource type in the process's pinned model version. Saving a different resource type in the model does not change existing exports until the process rebuilds. If the pinned model history is unavailable, the export returns HTTP 500 OperationOutcome before sending CSV.

A failed interval is retried after five seconds, up to three failed attempts. **Retry** requeues failed intervals with a fresh attempt budget. Pairs, interval completion and the pair count are committed together. An interrupted transaction does not leave partial results, and a worker from a previous process run cannot commit after another run takes ownership.

If a source record cannot be projected, the trigger records the error and allows the source write to succeed. The record remains absent from the projection until a full rebuild. Review these errors when checking result completeness.

## Reset and delete

Pause the process before using **Delete** on its card. This resets the process by removing its projection, trigger, intervals, pairs and errors; the BulkMatchingModel remains available for another Start. Reset is transactional and excludes a concurrent Start.

Deleting a paused BulkMatchingModel also removes its process and projection in the same database transaction. If the resource deletion rolls back, the process and its results are restored with it. This applies to FHIR deletion and direct deletion of the model's database row, including deletion through a separate Aidbox application sharing the database.

Deleting a model with an active process is refused. The process Reset API returns HTTP 409 on a conflict. Direct FHIR deletion returns HTTP 412 with an OperationOutcome for a transaction conflict. Pause the process and retry the deletion.

## API

All process endpoints use the MDMbox host and the same [API authentication](authentication.md) as other MDMbox operations.

| Method | Path | Result |
| --- | --- | --- |
| POST | `/api/bulk-match-v2/{model-id}/start` | 202 when starting or resuming; 200 if already active locally; 400 for invalid settings; 409 if another operation owns the model or the pool has insufficient capacity |
| POST | `/api/bulk-match-v2/{model-id}/pause` | 202 when pausing; 409 if the process is not active or is owned elsewhere |
| POST | `/api/bulk-match-v2/{model-id}/retry` | 200 with the number of requeued failed intervals |
| GET | `/api/bulk-match-v2/{model-id}/status` | JSON process status, including pinned and current model versions, settings and counts |
| GET | `/api/bulk-match-v2/{model-id}/pairs` | CSV of all stored pairs; 500 OperationOutcome if the pinned model history is unavailable |
| DELETE | `/api/bulk-match-v2/{model-id}` | 200 after Reset; 409 while the process is active or another operation owns it |

A missing model on Start, or a missing process on the other operations, returns 404. Action responses use OperationOutcome; status returns JSON and pairs returns CSV.

The Start request accepts these optional integer settings, each between 1 and 2147483647:

```json
{
  "workersCount": 4,
  "batchSize": 1000,
  "cutTimeoutMs": 2000
}
```

These are also the defaults when settings are omitted on an explicit Start. Explicit nulls, zero, negative, fractional and out-of-range values are invalid. The API returns HTTP 400 OperationOutcome for invalid settings; the admin page shows which setting to correct. Both validate before changing the process. Automatic resume retains the saved process settings. A refused Start leaves existing settings and results unchanged and creates no process row.

## Connection capacity

Bulk matching uses a separate database pool controlled by `MDMBOX_BULK_DB_*`. Each process reserves `workersCount + 1` connections, including one for its coordinator. Start returns 409 when that reservation, active local process reservations and unfinished batch job workers exceed `MDMBOX_BULK_DB_MAX_POOL_SIZE`. Pause another process, reduce the worker count or increase the bulk pool size before retrying. See [Configuration reference](config-reference.md#mdmbox-connection-pools).

## Current limitations

- Only inserts are synchronized. Updating or deleting a source record does not update the projection or retract its pairs. Recreating a deleted resource with the same ID retains the old projection row until a rebuild.
- CSV exports contain the full accumulated result, not a stream of changes.
- Pause keeps the sync trigger active. Use Reset or delete the paused model to remove it.
- A missing sync trigger is reported in the status and UI, but does not automatically fail the process. Pause, reset and start the process to rebuild it.
