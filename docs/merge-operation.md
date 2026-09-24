---
description: Use the $merge operation to merge duplicate FHIR resources with full audit trail and preview support.
---

# Merge operation

MDMbox provides two merge operations: server-managed `$merge/v2`, which builds the transaction with a sandboxed server-side algorithm, and client-plan `$merge`, which executes a transaction Bundle supplied by the caller. Both modes add Task, Provenance, and AuditEvent records and commit successful business and audit changes atomically.

## Server-managed merge

`$merge/v2` merges one duplicate FHIR resource (`source`) into the surviving resource (`target`). They must have the same `resourceType`, for example two Patients or two Organizations. Task, Provenance, AuditEvent, and Device are server-managed and cannot be a merge pair. The caller may supply the desired target `result`, select a server-side algorithm, and list the related resource types whose source references must be reassigned. There is no client-provided transaction plan.

```http
POST https://<mdmbox-host>/api/fhir/$merge/v2
Content-Type: application/fhir+json
```

```json
{
  "resourceType": "Parameters",
  "parameter": [
    {
      "name": "source",
      "valueReference": { "reference": "Patient/duplicate-123" }
    },
    {
      "name": "target",
      "valueReference": { "reference": "Patient/primary-456" }
    },
    { "name": "merge-algorithm", "valueString": "simple" },
    {
      "name": "result",
      "resource": {
        "resourceType": "Patient",
        "id": "primary-456",
        "name": [{ "given": ["John"], "family": "Smith" }]
      }
    },
    { "name": "related-resource-type", "valueString": "Encounter" },
    { "name": "related-resource-type", "valueString": "Observation" },
    { "name": "preview", "valueBoolean": true }
  ]
}
```

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `source` | valueReference | Yes | Relative reference to the duplicate resource that will be deleted |
| `target` | valueReference | Yes | Relative reference to a different resource of the same type |
| `result` | resource | No | Desired target state, with the target's resourceType and id; the built-in algorithm leaves the current target unchanged when omitted |
| `merge-algorithm` | valueString | No | Server-side algorithm id; defaults to `simple` |
| `related-resource-type` | valueString | No | Repeat once for each resource type whose references should be reassigned |
| `preview` | valueBoolean | No | Return the final audited plan without executing or persisting it (default: false) |

The default `simple` algorithm replaces target content with `result` when supplied, moves source references within the selected `related-resource-type` values to the target, and deletes the source.

`result` is the complete desired target content, not a partial update. Omit it to keep the target unchanged. Its `meta.versionId` is not a precondition; MDMbox protects writes using the current version read when computing the merge.

Only the listed related resource types are searched. If you omit them, related references are not moved. Include every type your workflow needs; [$referencing](referencing-operation.md) can help you inspect them. Related resources may have the pair's type, such as Organizations referring to another Organization through `partOf`.

### Preview and response

The example above uses `preview=true`. It returns HTTP 200 with FHIR `Parameters` containing `outcome` (OperationOutcome) and `plan` (the proposed transaction Bundle). No business or audit resources are written.

To execute, send the request with `preview=false`. Success returns `outcome` and the merge `task`. Save its ID to [unmerge](unmerge-operation.md) later. A preview does not reserve versions: execution computes a plan against the then-current state.

Algorithm warnings appear in the outcome with HTTP 200. An `error` or `fatal` issue blocks the operation and returns an OperationOutcome with HTTP 409.

### Validation and conflicts

Source and target must exist, be different resources of the same type, and not be marked [not a match](mark-not-a-match.md). Neither can already be the source of an active merge.

| Status | Meaning |
| --- | --- |
| 400 | Invalid request or unavailable algorithm |
| 404 | Source or target does not exist |
| 409 | The algorithm refuses the merge, or concurrent changes invalidate the plan |
| 422 | Invalid resource state or FHIR transaction data |
| 500 | Algorithm or server failure |

All merge writes are version-protected. On a concurrent-change conflict, the transaction rolls back; inspect current state before retrying.

### Audit and history

A successful merge commits the business changes, Task, Provenance, and AuditEvent together. Preview writes none of these; failed execution attempts are audited separately. See [Audit](audit.md).

The Task saves the pair's versions, algorithm identity, and related-resource-type scope. Provenance identifies pre-merge and actual post-merge versions, including resources created by the merge. Deleted resources retain a pre-delete version reference. Keep these records and their FHIR history for as long as server-managed unmerge is needed.

Find the operation's Provenance through Aidbox:

```http
GET https://<aidbox-host>/fhir/Provenance?target=Task/<task-id>
```

### Custom algorithms

A custom algorithm builds a transaction plan using `merge(input, mdm)`. It may accept additional request parameters. MDMbox validates its allowed resources, methods, and version preconditions before preview or execution. See the [JavaScript algorithm API](javascript-algorithm-api.md) for the complete contract and [Algorithm management](algorithms.md) to create or configure scripts.

These server-managed plan rules do not apply to client-plan operations; those have the separate contract below.

### Git algorithm storage

See [Git algorithm storage](algorithms.md#git-algorithm-storage) for repository layout, private access, synchronization, and limits.

### Managing algorithms in the Admin UI

See [Create or edit a script](algorithms.md#create-or-edit-a-script) and [Add and synchronize a source](algorithms.md#add-and-synchronize-a-source).

## Client-plan merge

The `$merge` operation merges two FHIR resources by executing a client-provided FHIR transaction Bundle. The client controls the changes; MDMbox executes them atomically and adds audit records.

### How it works

1. The client identifies a duplicate pair (source and target)
2. The client builds a FHIR transaction Bundle describing the merge (update target, reassign references, delete source)
3. MDMbox validates the request, adds audit resources (Task, Provenance, and AuditEvent), and executes the Bundle as a single transaction
4. If anything fails, the entire transaction rolls back, including its success audit records; a separate best-effort AuditEvent records the failed non-preview attempt

### Request

```http
POST https://<mdmbox-host>/api/fhir/$merge
Content-Type: application/json
```

```json
{
  "resourceType": "Parameters",
  "parameter": [
    {
      "name": "source",
      "valueReference": { "reference": "Patient/duplicate-123" }
    },
    {
      "name": "target",
      "valueReference": { "reference": "Patient/primary-456" }
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
              "ifMatch": "W/\"3\""
            },
            "resource": {
              "resourceType": "Patient",
              "id": "primary-456",
              "name": [{ "given": ["John"], "family": "Smith" }],
              "birthDate": "1985-03-20"
            }
          },
          {
            "request": {
              "method": "PUT",
              "url": "Encounter/enc-789",
              "ifMatch": "W/\"1\""
            },
            "resource": {
              "resourceType": "Encounter",
              "id": "enc-789",
              "status": "finished",
              "class": { "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode", "code": "AMB" },
              "subject": { "reference": "Patient/primary-456" }
            }
          },
          {
            "request": { "method": "DELETE", "url": "Patient/duplicate-123" }
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
| `source` | valueReference | Yes | The resource to be merged away (deleted) |
| `target` | valueReference | Yes | The surviving resource |
| `preview` | valueBoolean | No | If true, return the assembled Bundle without executing (default: false) |
| `plan` | resource (Bundle) | Yes | FHIR transaction Bundle with the merge changes |

#### Plan Bundle

The plan is a standard FHIR transaction Bundle. It typically contains:

- A `PUT` entry for the target resource (with updated data)
- `PUT` entries to reassign references from related resources (Encounters, Observations, etc.)
- A `DELETE` entry for the source resource

Use `ifMatch` headers (ETags) for optimistic locking. If a resource was modified between when the client read it and when the merge executes, the entire transaction rolls back with a `422 Unprocessable Entity` response (code `conflict`).

### Preview mode

In the request above, change `preview` to `true` and keep the complete `plan`. MDMbox returns FHIR `Parameters` with `outcome` and `bundle`, the assembled transaction including audit resources, without writing anything.

Client-plan preview checks request structure and current state. FHIR resource validation occurs when the transaction executes, so a successful preview does not guarantee that execution will succeed.

### Response

On success, the response is a Parameters resource containing the outcome, input summary, Task, and resulting target. Resource bodies below are abbreviated:

```json
{
  "resourceType": "Parameters",
  "parameter": [
    {
      "name": "outcome",
      "resource": {
        "resourceType": "OperationOutcome",
        "issue": [
          {
            "severity": "information",
            "code": "informational",
            "details": {
              "text": "Merge completed: Patient/duplicate-123 -> Patient/primary-456"
            }
          }
        ]
      }
    },
    {
      "name": "input-parameters",
      "resource": {
        "resourceType": "Parameters",
        "parameter": [
          {
            "name": "source",
            "valueReference": { "reference": "Patient/duplicate-123" }
          },
          {
            "name": "target",
            "valueReference": { "reference": "Patient/primary-456" }
          },
          { "name": "preview", "valueBoolean": false }
        ]
      }
    },
    {
      "name": "task",
      "resource": {
        "resourceType": "Task",
        "id": "generated-task-id",
        "status": "completed",
        "code": { "coding": [{ "code": "merge" }] },
        "businessStatus": { "coding": [{ "code": "merged" }] },
        "for": { "reference": "Patient/duplicate-123" },
        "focus": { "reference": "Patient/primary-456" }
      }
    },
    {
      "name": "result",
      "resource": {
        "resourceType": "Patient",
        "id": "primary-456"
      }
    }
  ]
}
```

### Audit trail

Every executed merge creates three audit resources inside the same transaction:

**Task** — records the merge event:

- `for` — the source (merged away)
- `focus` — the target (survivor)
- `businessStatus` — `merged`
- `code` — `merge`

**Provenance** — records what was changed:

- `target` — all affected resources plus the operation Task
- `entity[]` — versioned references to pre-change revisions of modified or deleted resources when available; newly created resources have no pre-change revision
- `agent` — `Device/mdmbox`
- `activity` — `merge` from `http://terminology.hl7.org/CodeSystem/iso-21089-lifecycle`

**AuditEvent** — records the initiating user or client when available, operation outcome, service, request correlation, and references to the Task, Provenance, and domain resources. Its write is mandatory: a failure rolls back the merge. See [Audit](audit.md) for queries and failure/preview behavior.

Find the provenance for a Task through Aidbox with `GET /fhir/Provenance?target=Task/<task-id>`. Task, Provenance, and the referenced FHIR history versions enable future unmerge. Tasks also power [Notifications](notifications.md) — downstream systems can subscribe to merge and unmerge events via Topic-Based Subscriptions.

### Unmerge

A completed merge can be reversed with `$unmerge`. The unmerge request points to the original merge Task and supplies a client-built reverse transaction Bundle. MDMbox executes that reverse plan atomically, creates its own Task, Provenance, and AuditEvent, and updates the original merge Task to `businessStatus=unmerged`.

See [Unmerge operation](unmerge-operation.md).

### Validation

MDMbox validates the merge request before execution:

**Structural validation (400 Bad Request):**

- Source and target must be different resources
- Plan must be a transaction Bundle with at least one entry
- No duplicate PUT/DELETE URLs in the plan

**State validation (422 Unprocessable Entity):**

- Both source and target must exist
- Source must not already be merged (no active merge Task)
- Target must not already be a source in another merge (no circular merges)

**FHIR transaction validation (4xx OperationOutcome):**

- Resources in the plan are validated when the FHIR transaction executes
- If a resource declares `meta.profile`, the corresponding FHIR package must be installed and the resource must satisfy the profile
- If validation fails, the transaction rolls back, including Task, Provenance, and the success AuditEvent; a separate failure AuditEvent is attempted for non-preview requests

#### Profiled resources in the merge plan

If a resource written by the merge `plan` declares `meta.profile`, install the package that contains the profile in Aidbox before calling `$merge`. For US Core 6.1.0:

```http
POST https://<aidbox-host>/fhir/$fhir-package-install
Content-Type: application/json
```

```json
{
  "resourceType": "Parameters",
  "parameter": [{ "name": "package", "valueString": "hl7.fhir.us.core@6.1.0" }]
}
```

During `$merge`, every profiled resource in the transaction is validated. If any resource violates its declared profile, MDMbox returns the FHIR validation `OperationOutcome` and rolls back the complete merge transaction.

### Finding related resources

Use the `$referencing` operation to discover resources that reference a given resource. This is useful when building the merge plan — you need to know which Encounters, Observations, etc. point to the source and need to be reassigned.

See [Referencing operation](referencing-operation.md).
