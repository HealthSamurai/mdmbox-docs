---
description: Use the $unmerge operation to reverse a previous merge with an auditable transaction.
---

# Unmerge operation

MDMbox provides two modes of `$unmerge`: server-managed `$unmerge/v2`, which reconstructs the reversal from the merge audit trail, and client-plan `$unmerge`, which executes a reverse transaction supplied by the caller. Both modes create an unmerge Task, Provenance, and AuditEvent, change the original merge Task to `businessStatus=unmerged`, and commit all changes atomically.

Use `$unmerge` when a merge was accepted by mistake and the affected resources must be restored or reassigned.

## Server-managed unmerge

Pass the Task ID returned by the merge. MDMbox uses the recorded resource history to build a reverse plan. The example previews that plan with the default `restore` algorithm:

```http
POST https://<mdmbox-host>/api/fhir/$unmerge/v2
Content-Type: application/fhir+json
```

```json
{
  "resourceType": "Parameters",
  "parameter": [
    {
      "name": "task",
      "valueReference": { "reference": "Task/merge-task-123" }
    },
    { "name": "unmerge-algorithm", "valueString": "restore" },
    { "name": "preview", "valueBoolean": true }
  ]
}
```

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `task` | valueReference | Yes | Reference to the active pair-merge Task to reverse |
| `unmerge-algorithm` | valueString | No | Server-side algorithm id: built-in `restore` (default), `strict`, or a custom Git/database algorithm |
| `preview` | valueBoolean | No | Compute and return the audited transaction plan without executing it (default: false) |

### Algorithms

Choose the policy for changes made after the merge:

| Algorithm | Later changes |
| --- | --- |
| `restore` (default) | Restores recorded pre-merge content, overwriting later edits with warnings |
| `strict` | Refuses conflicting changes and reverses compatible reference updates |

**Restore** restores the source, target, and resources changed by the merge. It deletes resources created by the merge, even if they were edited later. Overwritten or deleted resources are reported as warnings. Review the preview outcome before executing.

**Strict** returns HTTP 409 if the target changed, the source was recreated, or a merge-created resource was edited. For existing related resources changed by the merge, it restores references only at their original paths and preserves a later deletion of the entire resource.

Strict has an additional rule for references inside arrays: every containing array must still match its expected post-merge state. Reordering, adding or removing elements, or editing a field inside such an array causes a conflict. Changes outside those arrays are preserved. For a scalar Reference, only its `reference` value changes; later edits to fields such as `display` are kept.

Strict supports the reference changes made by the built-in `simple` merge algorithm. It is not a general inverse of arbitrary custom merge scripts.

Both built-ins leave resources outside the original merge changes untouched and report one warning per discovered resource that still refers to the target. This search uses only the `related-resource-type` scope saved by the merge Task. It does not search other types or include writes committed after the unmerge snapshot.

### Custom algorithms

Select a custom script using `unmerge-algorithm`. Scripts may accept additional request parameters and must return a plan that restores the source exactly once, keeps the target, and changes only resources covered by the merge audit. All writes require version or absence preconditions.

See [Algorithm management](algorithms.md) for built-in settings, database scripts, and Git sources. The [JavaScript algorithm API](javascript-algorithm-api.md) describes inputs, helpers, result shapes, and plan restrictions.

### Later merge chain

Pair unmerge is last-in-first-out for merges into the same target resource. Before computing a plan, MDMbox verifies that the Task's target resource still exists and looks for active merge Tasks into that resource created after the requested Task. If any exist, the response is `409 Conflict`; `OperationOutcome.issue.diagnostics` contains the full chronological Task chain and identifies the latest Task that must be unmerged first.

### Preview and response

For preview, the response is a `Parameters` resource containing `outcome` (`OperationOutcome`) and `plan` (the complete audited transaction Bundle). Preview performs no writes.

Set `preview=false` to execute. Success returns HTTP 200 with `outcome` and the new unmerge `task`. Warnings do not block execution. The reversal and its successful audit records commit together; failed attempts are audited separately. See [Audit](audit.md).

Both algorithms execute against a version-protected database snapshot. Restore intentionally discards changes made before that snapshot, but does not overwrite a concurrent write made while it computes or executes its plan: such a conflict returns HTTP 409 and rolls back the restoration and its successful audit together.

| Status | Meaning |
| --- | --- |
| 400 | Invalid request or unavailable algorithm |
| 404 | Merge Task or original target is missing; unmerge does not recreate a deleted target |
| 409 | Later merge in the chain, algorithm conflict, or concurrent change |
| 422 | Missing or inconsistent audit/history evidence, or invalid FHIR transaction data |
| 500 | Algorithm or storage failure |

Errors return an OperationOutcome and make no partial business changes.

### Required history

Keep the original Task, Provenance, pre-merge snapshots, and recorded post-merge versions, including creation versions of resources added by the merge. An edited audit record or another resource version cannot replace missing evidence. Missing or inconsistent history returns HTTP 422 without partial restoration.

The Task also retains the target version when merge left it unchanged, and the original `related-resource-type` search scope.

## Client-plan unmerge

The `$unmerge` operation reverses a previous merge by executing a client-provided FHIR transaction Bundle. The client decides exactly how to restore resources; MDMbox validates the referenced merge Task, adds audit resources, flips the original merge Task to `unmerged`, and executes everything atomically.

### How it works

1. The client finds the original merge `Task`.
2. The client reads the merge audit trail with `GET https://<aidbox-host>/fhir/Provenance?target=Task/<task-id>` and builds a reverse transaction Bundle.
3. The client calls `$unmerge` with the merge Task reference and the reverse plan.
4. MDMbox adds an unmerge `Task`, `Provenance`, and `AuditEvent`, updates the original merge Task to `businessStatus=unmerged`, and executes the Bundle as one transaction.
5. If anything fails, the entire transaction rolls back, including its success audit records and the merge Task status update. A separate best-effort AuditEvent records the failed non-preview attempt.

### Request

```http
POST https://<mdmbox-host>/api/fhir/$unmerge
Content-Type: application/json
```

```json
{
  "resourceType": "Parameters",
  "parameter": [
    {
      "name": "task",
      "valueReference": { "reference": "Task/merge-task-123" }
    },
    { "name": "preview", "valueBoolean": false },
    {
      "name": "plan",
      "resource": {
        "resourceType": "Bundle",
        "type": "transaction",
        "entry": [
          {
            "request": {
              "method": "PUT",
              "url": "Patient/primary-456",
              "ifMatch": "W/\"4\""
            },
            "resource": {
              "resourceType": "Patient",
              "id": "primary-456",
              "name": [{ "given": ["John"], "family": "Smith" }]
            }
          },
          {
            "request": { "method": "PUT", "url": "Patient/duplicate-123" },
            "resource": {
              "resourceType": "Patient",
              "id": "duplicate-123",
              "name": [{ "given": ["Jon"], "family": "Smyth" }]
            }
          },
          {
            "request": {
              "method": "PUT",
              "url": "Encounter/enc-789",
              "ifMatch": "W/\"2\""
            },
            "resource": {
              "resourceType": "Encounter",
              "id": "enc-789",
              "status": "finished",
              "class": { "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode", "code": "AMB" },
              "subject": { "reference": "Patient/duplicate-123" }
            }
          }
        ]
      }
    }
  ]
}
```

#### Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `task` | valueReference | Yes | Reference to the original merge Task |
| `preview` | valueBoolean | No | If true, return the assembled Bundle without executing (default: false) |
| `plan` | resource (Bundle) | Yes | FHIR transaction Bundle with the reverse changes |

#### Plan Bundle

The plan is a standard FHIR transaction Bundle. It commonly contains:

- `PUT` entries that restore the target and related resources to the desired post-unmerge state
- `PUT` entries that recreate resources deleted by the merge
- `PUT` entries that reassign related resources back to the restored source
- optional `POST` or `DELETE` entries if the client policy requires them

Allowed plan methods are `PUT`, `POST`, and `DELETE`. The plan must not contain duplicate `PUT` or `DELETE` URLs.

Use `ifMatch` for optimistic locking when updating live resources. If a resource changed after the client built the reverse plan, the FHIR transaction rolls back and `$unmerge` returns `422 Unprocessable Entity` with an `OperationOutcome` code such as `conflict`.

### Preview mode

In the request above, change `preview` to `true` and keep the complete reverse plan. The response is FHIR `Parameters` with `outcome` and `bundle`, including the proposed audit records and merge Task update. Preview writes nothing.

Client-plan preview checks request structure and current state. FHIR resource validation occurs during execution.

### Response

On success, the response is a `Parameters` resource containing:

```json
{
  "resourceType": "Parameters",
  "parameter": [
    {
      "name": "outcome",
      "resource": {
        "resourceType": "OperationOutcome",
        "issue": [{ "severity": "information", "code": "informational" }]
      }
    },
    {
      "name": "input-parameters",
      "resource": {
        "resourceType": "Parameters",
        "parameter": [
          {
            "name": "task",
            "valueReference": { "reference": "Task/merge-task-123" }
          },
          { "name": "preview", "valueBoolean": false }
        ]
      }
    },
    {
      "name": "task",
      "resource": {
        "resourceType": "Task",
        "id": "generated-unmerge-task-id",
        "status": "completed",
        "intent": "order",
        "code": { "coding": [{ "code": "unmerge" }] },
        "businessStatus": { "coding": [{ "code": "completed" }] },
        "basedOn": [{ "reference": "Task/merge-task-123" }]
      }
    }
  ]
}
```

The `input-parameters` echo omits the potentially large `plan` parameter.

### Audit trail

Every executed unmerge creates or updates these resources in the same transaction:

**Unmerge Task**

- `code` - `unmerge`
- `businessStatus` - `completed`
- `basedOn` - the original merge Task
- `for` and `focus` - copied from the original merge Task when present

**Original merge Task**

- `businessStatus` changes from `merged` to `unmerged`
- updated with `ifMatch` using the Task version read during validation

**Provenance**

- `activity` - `unmerge` from `http://terminology.hl7.org/CodeSystem/iso-21089-lifecycle`
- `target` - every reverse-plan target plus the unmerge Task
- `entity[]` - versioned references to pre-unmerge revisions when available
- `agent` - `Device/mdmbox`

**AuditEvent** records the initiating user or client when available, outcome, service, correlation, and references to the original merge Task, new unmerge Task, Provenance, and domain resources. If this event cannot be written, the reversal rolls back. See [Audit](audit.md) for failure and preview behavior.

After a successful unmerge, the original source can be merged again because the previous merge Task is no longer active.

### Validation

MDMbox validates the unmerge request before execution:

**Structural validation (400 Bad Request):**

- Request body must be a FHIR `Parameters` resource
- `task` is required
- `plan` must be a transaction Bundle with at least one entry
- Plan methods must be `PUT`, `POST`, or `DELETE`
- No duplicate `PUT` or `DELETE` URLs in the plan

**State validation (422 Unprocessable Entity):**

- The referenced Task must exist
- The Task must be a merge Task (`code=merge`)
- The merge Task must still be active (`businessStatus=merged`)

**FHIR transaction validation (422 or 500):**

- If any transaction entry fails validation or optimistic locking, the whole transaction rolls back
- Client-side transaction failures return `422` with an `OperationOutcome`
- Server-side transaction failures return `500`

### See also

{% content-ref %}
[Merge operation](merge-operation.md)
{% endcontent-ref %}

{% content-ref %}
[Referencing operation](referencing-operation.md)
{% endcontent-ref %}
