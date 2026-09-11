---
description: Use the $unmerge operation to reverse a previous merge with an auditable transaction.
---

# Unmerge operation

MDMbox provides two versions of `$unmerge`: server-computed `$unmerge/v2`, which reconstructs the reversal from the merge audit trail, and client-plan `$unmerge`, which executes a reverse transaction supplied by the caller. Both versions create an unmerge Task and Provenance, change the original merge Task to `businessStatus=unmerged`, and commit all changes atomically.

Use `$unmerge` when a merge was accepted by mistake and the affected resources must be restored or reassigned.

## Server-computed unmerge v2

`$unmerge/v2` needs only the original merge Task, an optional algorithm, and preview mode. MDMbox reads the Task's Provenance, fetches the pre-merge versions referenced by `Provenance.entity`, and uses the post-merge versions in `Provenance.target` to detect later changes. It computes the reverse transaction in sandboxed JavaScript and executes it in the same database transaction. For an unchanged target resource, the Task's saved target version is also the post-merge baseline.

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
| `unmerge-algorithm` | valueString | No | Server-side algorithm id: built-in `restore` (default), `strict`, or a configured Git algorithm |
| `preview` | valueBoolean | No | Compute and return the audited transaction plan without executing it (default: false) |

### Algorithms

Operators can restrict built-ins with `MDMBOX_BUILT_IN_ALGORITHMS`. Unset enables
all; empty disables all; `simple,strict` enables simple merge and strict unmerge.
The default unmerge id remains `restore`, even when restore is disabled: such a
request returns HTTP 400 unless a configured Git script provides that id.
Explicitly request `strict` when only strict is enabled. Both preview and
execution enforce the same allowlist. Custom Git algorithms are unaffected.

Custom scripts can be loaded from `unmerge/<id>.js` in the configured public or
private [Git algorithm repository](merge-operation.md#git-algorithm-storage).
They define `unmerge(input, mdm)` and are pinned at startup. Their Task records
the executed commit, path, and script digest, just as for Git merge algorithms.

The built-in `restore` algorithm restores the source resource, target resource, and resources changed by the merge to their recorded pre-merge versions. Changes made after merge are deliberately overwritten. Each overwritten or deleted resource is reported as a warning in the response `OperationOutcome`. A resource created by the merge is removed even if it was edited later, with a warning. A separate resource created after merge that references the target is not moved because its ownership is ambiguous; it remains linked to the target and is also reported as a warning.

The built-in `strict` algorithm returns `409 Conflict` when the target resource changed or the source was recreated after merge, a resource created by the merge was edited later, or a separate resource created after merge references the target resource. For an existing related resource, MDMbox changes only a reference to the original source whose exact historical path still references the target. A later deletion of the whole related resource is preserved.

For references inside arrays, `strict` uses a conservative rule: each containing array, including ancestor arrays of nested references, must match the expected state immediately after `simple` relinked the references. Reordering, adding or removing elements, or editing any field inside one of these arrays returns `409 Conflict` in both preview and execution. This applies even when the original index still references the target; the algorithm does not guess which element moved. Changes outside these arrays, such as an Observation note outside its relinked `performer` array, remain allowed and are preserved.

The strict algorithm is a reference implementation for `simple`-style related-resource relinking, not a universal inverse of arbitrary custom merge mutations. Custom algorithms must account for this compatibility boundary. Merge v2 also rejects conditional creation (`ifNoneExist`) so an existing resource cannot be mistaken for one created by the merge.

For a scalar Reference outside those arrays, strict changes only its `reference` value. Allowed later fields such as `display` and `extension` are preserved. Source/target and merge-created resource drift is checked by version, including writes from transactions that started before merge but committed afterward.

Both algorithms run in the same sandbox used by merge v2. They can read only the merge Task, Provenance, versioned resource history, current resource state, and reference paths exposed through the MDMbox algorithm API.

Like merge v2, JavaScript unmerge algorithms return `{plan, outcome?}`. Without specific messages they return only `{plan: bundle}`; MDMbox supplies the informational OperationOutcome for the HTTP response. If provided, `outcome` must contain at least one issue, not `null` or an empty `issue` array. An `error` or `fatal` issue blocks execution with HTTP 409 even when a plan is present. `plan: null` is allowed only with such a blocking issue; the `plan` key is required. Invalid results return HTTP 500. See the [merge result contract](merge-operation.md#server-computed-merge-v2) for details and FHIR requirements.

Custom unmerge algorithms use `mdm.fhirGet('Patient/123')` for the current resource and `mdm.fhirGet('Patient/123/_history/20')` for an exact historical version. Both return a FHIR resource directly, or `null` when absent. Use `resource.meta.versionId`, not a separate metadata wrapper. This replaces `readCurrentResource`, `readHistoricalResource`, and `readOperationResource`; the saved post-merge references are supplied in `input.provenance.target`. Libox's creation timestamp remains in `meta.extension`, identified by `input.createdAtExtensionUrl`.

Common FHIR helpers are provided by the server API:

- `mdm.resourceReference(resource)` returns `ResourceType/id`.
- `mdm.referenceWithoutHistoryVersion(reference)` removes an optional `/_history/version` suffix from a local reference.
- `mdm.restorableResource(resource)` returns a copy without server lifecycle metadata (`meta.versionId`, `meta.lastUpdated`, and the configured creation-time extension), preserving other metadata. The algorithm must still set a current-version or absence precondition on its write.
- `mdm.resourceCreatedAt(resource)` returns the configured creation-time extension's instant string without precision loss, or `null` if the resource or extension is absent.
- `mdm.hasResourceChangedAfterMerge(currentResource, provenance, preMergeResource?)` compares the current `meta.versionId` with the matching versioned `Provenance.target`. Supply the pre-merge FHIR resource as the baseline when merge left it unchanged, as with a target without `result`. Merge-created resources need no pre-merge baseline. A missing current resource returns `false`; the algorithm handles deletion separately. No database read is performed.
- `mdm.referenceFhirPathsToRestoreSource(preMergeResource, currentResource, sourceReference, targetReference)` returns zero-based FHIRPath paths to the Reference objects that can be safely relinked back to source, such as `Observation.subject` or `Observation.performer[0]`. These are only the original source-reference slots, not every current target reference or the `.reference` fields. The helper applies strict's conservative array checks for `simple`-style relinking. It returns `[]` if there were no source references, or `null` on ambiguity, never a partial list. It does not modify resources or execute a plan.
- `mdm.putRequestWithPrecondition(reference, currentResource)` builds a PUT request with `ifMatch` from the current resource's `meta.versionId`, or `ifNoneMatch: "*"` when the current resource is `null`. An existing resource without a version is rejected. This helper builds a request without executing it.
- `mdm.preMergeTargetVersion(mergeTask)` returns the saved pre-merge `target-version` string, or `null` if that input is absent. It reads the MDM merge Task input coding; it is not the current version used to protect a write.
- `mdm.operationOutcomeIssue(severity, code, message, diagnostics?)` builds one `OperationOutcome.issue`, with `details.text` and optional diagnostics. It supports warnings, errors, and information; it does not wrap the issue in an OperationOutcome resource.
- `mdm.resourceReferencesCreatedAfter(reference, resourceTypes, instant)` returns distinct references to current resources in the supplied types that reference `reference` and were created strictly after `instant`. Contained references are excluded; an empty type scope returns an empty array.

The built-in algorithms pass `input.targetReference`, `input.relatedResourceTypes`, and `input.mergeCreatedAt` to the last helper. The server supplies only the original Task's recorded `related-resource-type` inputs. Without those inputs, the additional search scope is empty; types are not inferred from snapshots. Resources already recorded in the merge audit are still processed by the selected unmerge algorithm.

Post-merge versions determine whether an audited resource changed. Creation time is still used to discover separately created resources and to recognize a deleted-and-recreated related resource; changing an existing resource does not count as creating one. Timestamp ordering is performed on the server, without JavaScript precision loss. Libox timestamps reflect transaction start, not commit order, so this creation-time check does not establish the order of concurrent commits.

### Later merge chain

Pair unmerge is last-in-first-out for merges into the same target resource. Before computing a plan, MDMbox verifies that the Task's target resource still exists and looks for active merge Tasks into that resource created after the requested Task. If any exist, the response is `409 Conflict`; `OperationOutcome.issue.diagnostics` contains the full chronological Task chain and identifies the latest Task that must be unmerged first.

### Preview and response

For preview, the response is a `Parameters` resource containing `outcome` (`OperationOutcome`) and `plan` (the complete audited transaction Bundle). Preview performs no writes.

For successful execution, the response contains `outcome` and the new unmerge `task`. Warnings do not change the HTTP 200 status. A strict drift conflict returns the `OperationOutcome` directly with HTTP 409 and makes no business changes. Operation-level AuditEvent emission and failure auditing are deferred to a separate change. A missing merge Task or deleted original target resource returns `404 Not Found`; unmerge never recreates a deleted target.

Both algorithms execute against a version-protected database snapshot. Restore intentionally discards changes made before that snapshot, but does not overwrite a concurrent write made while it computes or executes its plan: such a conflict returns HTTP 409 and rolls back the restoration and its successful audit together.

Keep the original Task, Provenance, and required FHIR history versions. An edited audit revision cannot substitute for a missing original. Before deleting a resource described as merge-created, MDMbox also requires its recorded creation version from that merge transaction. Missing or inconsistent evidence returns `422 Unprocessable Entity` without partial restoration.

Retention must include the pinned post-merge versions as well as the pre-merge snapshots. If an explicitly recorded version is missing, neither algorithm substitutes another version. Older audits with unversioned mutation targets remain supported through server-side history lookup, provided the necessary original versions still exist; no audit migration is required.

The original merge Task records the source and target history versions plus every `related-resource-type` scope selected by merge v2. This lets unmerge v2 restore a target that the merge algorithm did not modify and detect a new referenced resource even when no resource of that type existed at merge time.

## Client-plan unmerge v1

The original `$unmerge` operation reverses a previous `$merge` by executing a client-provided FHIR transaction Bundle. The client decides exactly how to restore resources; MDMbox validates the referenced merge Task, adds audit resources, flips the original merge Task to `unmerged`, and executes everything atomically.

## How it works

1. The client finds the original merge `Task`.
2. The client reads the merge audit trail with `GET /Provenance?target=Task/<task-id>` and builds a reverse transaction Bundle.
3. The client calls `$unmerge` with the merge Task reference and the reverse plan.
4. MDMbox adds an unmerge `Task`, adds `Provenance`, updates the original merge Task to `businessStatus=unmerged`, and executes the Bundle as one transaction.
5. If anything fails, the entire transaction rolls back, including audit records and the merge Task status update.

## Request

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
              "subject": { "reference": "Patient/duplicate-123" }
            }
          }
        ]
      }
    }
  ]
}
```

### Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `task` | valueReference | Yes | Reference to the original merge Task |
| `preview` | valueBoolean | No | If true, return the assembled Bundle without executing (default: false) |
| `plan` | resource (Bundle) | Yes | FHIR transaction Bundle with the reverse changes |

### Plan Bundle

The plan is a standard FHIR transaction Bundle. It commonly contains:

- `PUT` entries that restore the target and related resources to the desired post-unmerge state
- `PUT` entries that recreate resources deleted by the merge
- `PUT` entries that reassign related resources back to the restored source
- optional `POST` or `DELETE` entries if the client policy requires them

Allowed plan methods are `PUT`, `POST`, and `DELETE`. The plan must not contain duplicate `PUT` or `DELETE` URLs.

Use `ifMatch` for optimistic locking when updating live resources. If a resource changed after the client built the reverse plan, the FHIR transaction rolls back and `$unmerge` returns `422 Unprocessable Entity` with an `OperationOutcome` code such as `conflict`.

## Preview mode

Set `preview` to `true` to validate the request and inspect the assembled transaction without writing anything:

```json
{
  "resourceType": "Parameters",
  "parameter": [
    {
      "name": "task",
      "valueReference": { "reference": "Task/merge-task-123" }
    },
    { "name": "preview", "valueBoolean": true },
    {
      "name": "plan",
      "resource": {
        "resourceType": "Bundle",
        "type": "transaction",
        "entry": [
          { "request": { "method": "PUT", "url": "Patient/duplicate-123" } }
        ]
      }
    }
  ]
}
```

Preview response:

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
      "name": "bundle",
      "resource": {
        "resourceType": "Bundle",
        "type": "transaction",
        "entry": ["... assembled entries including audit resources ..."]
      }
    }
  ]
}
```

## Response

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

## Audit trail

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

After a successful unmerge, the original source can be merged again because the previous merge Task is no longer active.

## Validation

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

## See also

{% content-ref %}
[Merge operation](merge-operation.md)
{% endcontent-ref %}

{% content-ref %}
[Referencing operation](referencing-operation.md)
{% endcontent-ref %}
