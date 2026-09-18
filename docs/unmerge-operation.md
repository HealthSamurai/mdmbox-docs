---
description: Use the $unmerge operation to reverse a previous merge with an auditable transaction.
---

# Unmerge operation

MDMbox provides two versions of `$unmerge`: server-computed `$unmerge/v2`, which reconstructs the reversal from the merge audit trail, and client-plan `$unmerge`, which executes a reverse transaction supplied by the caller. Both versions create an unmerge Task, Provenance, and AuditEvent, change the original merge Task to `businessStatus=unmerged`, and commit all changes atomically.

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
| `unmerge-algorithm` | valueString | No | Server-side algorithm id: built-in `restore` (default), `strict`, or a custom Git/database algorithm |
| `preview` | valueBoolean | No | Compute and return the audited transaction plan without executing it (default: false) |

### Algorithms

Custom algorithms may accept additional named parameters, including nested `part`, embedded `resource`, and all `value[x]` fields. As in `$merge/v2`, the complete FHIR Parameters request is available as `input.parameters`, preserving repeated parameters, their order, and resource metadata. These values cannot override the server-supplied source, target, Task, or Provenance. The selected algorithm interprets and validates its additional parameters; built-in algorithms ignore them. For example, an algorithm can accept encounter and patient references as a repeated assignment parameter and validate each requested destination. See [custom parameters](javascript-algorithm-api.md#custom-parameters-merge-and-unmerge) for the shared contract.

Custom v2 unmerge plans are limited to the source, target, and resources represented in the original merge Provenance. Resources outside that audit scope cannot be added to the reversal plan. All writes retain version or absence preconditions and are included in the new unmerge audit. The algorithm must restore the source exactly once, cannot delete the target, and cannot mutate server-managed audit resources. Built-in `restore` and `strict` leave external resources at the target.

Operators can restrict built-ins with `MDMBOX_BUILT_IN_ALGORITHMS`. Unset enables
all; empty disables all; `simple,strict` enables simple merge and strict unmerge.
The default unmerge id remains `restore`, even when restore is disabled: such a
request returns HTTP 400 unless a custom Git or database script provides that id.
Explicitly request `strict` when only strict is enabled. Both preview and
execution enforce the same allowlist. Custom Git and database algorithms are unaffected.

Custom scripts can be loaded from `unmerge/<id>.js` in the configured public or
private [Git algorithm repository](merge-operation.md#git-algorithm-storage).
They define `unmerge(input, mdm)` and use the last successfully published
revision. Use **Algorithms → Configuration → Sync** to publish updates without
restarting; merge and unmerge catalogs from that source change together.
Their Task records the source id, executed commit, path, and script digest,
just as for Git merge algorithms. A sync does not change scripts already
selected by in-flight operations.

Alternatively, use **Algorithms → Unmerge** in the
[Admin UI](merge-operation.md#managing-algorithms-in-the-admin-ui) to create,
duplicate, edit, and delete database scripts. Database unmerge algorithms also
define `unmerge(input, mdm)` and are available to subsequent requests without a
restart. Merge and unmerge ids are independent. Resolution order is built-in,
Git, then database; the Task records the selected storage and executed script's
SHA-256. Built-in and Git scripts can be inspected and duplicated, but not
changed in place.

The built-in `restore` algorithm restores the source resource, target resource, and resources changed by the merge to their recorded pre-merge versions. Changes made after merge are deliberately overwritten. Each overwritten or deleted resource is reported as a warning in the response `OperationOutcome`. A resource created by the merge is removed even if it was edited later, with a warning.

The built-in `strict` algorithm checks reversibility of the merge's own changes. It returns `409 Conflict` when the target resource changed, the source was recreated after merge, or a resource created by the merge was edited later. For an audited existing related resource, MDMbox changes only a reference to the original source whose exact historical path still references the target. A later deletion of the whole related resource is preserved.

Both algorithms leave discovered target-referencing resources outside the merge changes untouched, with one warning per resource: `Resource outside merge changes remains linked to the target resource`. These resources remain at target with their current contents and versions. They may have existed before merge, been created afterward, or acquired a target reference later; MDMbox does not infer their age or ownership. Their presence does not block strict unmerge. Discovery uses the unmerge snapshot and the original `related-resource-type` scope; it does not include writes committed after that snapshot. Resources created by the merge itself are identified from its audit and handled separately.

For references inside arrays, `strict` uses a conservative rule: each containing array, including ancestor arrays of nested references, must match the expected state immediately after `simple` relinked the references. Reordering, adding or removing elements, or editing any field inside one of these arrays returns `409 Conflict` in both preview and execution. This applies even when the original index still references the target; the algorithm does not guess which element moved. Changes outside these arrays, such as an Observation note outside its relinked `performer` array, remain allowed and are preserved.

The strict algorithm is a reference implementation for `simple`-style related-resource relinking, not a universal inverse of arbitrary custom merge mutations. Custom algorithms must account for this compatibility boundary. Merge v2 also rejects conditional creation (`ifNoneExist`) so an existing resource cannot be mistaken for one created by the merge.

For a scalar Reference outside those arrays, strict changes only its `reference` value. Allowed later fields such as `display` and `extension` are preserved. Source/target and merge-created resource drift is checked by version, including writes from transactions that started before merge but committed afterward.

Both algorithms run in the same sandbox used by merge v2. They can read only the merge Task, Provenance, versioned resource history, current resource state, and reference paths exposed through the MDMbox algorithm API.

Like merge v2, JavaScript unmerge algorithms return `{plan, outcome?}`. Without specific messages they return only `{plan: bundle}`; MDMbox supplies the informational OperationOutcome for the HTTP response. If provided, `outcome` must contain at least one issue, not `null` or an empty `issue` array. An `error` or `fatal` issue blocks execution with HTTP 409 even when a plan is present. `plan: null` is allowed only with such a blocking issue; the `plan` key is required. Invalid results return HTTP 500. See the [merge result contract](merge-operation.md#server-computed-merge-v2) for details and FHIR requirements.

Custom unmerge algorithms use `mdm.fhirGet('Patient/123')` for the current resource and `mdm.fhirGet('Patient/123/_history/20')` for an exact historical version. Both return a FHIR resource directly, or `null` when absent. Use `resource.meta.versionId`, not a separate metadata wrapper. This replaces `readCurrentResource`, `readHistoricalResource`, and `readOperationResource`; the saved post-merge references are supplied in `input.provenance.target`. Libox's creation timestamp remains in `meta.extension`, identified by `input.createdAtExtensionUrl`.

The [JavaScript algorithm API](javascript-algorithm-api.md) is the complete
reference for `input`, `mdm`, return values, errors, and write preconditions.
It also explains which helpers are unmerge-only and the different Reference
metadata behavior of `referencePatchEntries` in merge and unmerge.

The built-ins call `mdm.referencePatchPaths(input.targetReference, input.relatedResourceTypes)` and exclude resources already represented by pre-merge snapshots or `Provenance.target` when reporting resources outside merge changes. The server supplies only the original Task's recorded `related-resource-type` inputs. Without those inputs, the additional search scope is empty; types are not inferred from snapshots. Resources already recorded in the merge audit are still processed by the selected unmerge algorithm.

Post-merge versions determine whether an audited resource changed. Strict still uses creation-time metadata to recognize a deleted-and-recreated audited related resource. External-resource discovery does not compare timestamps: a resource committed after merge may belong to a transaction that started earlier. The temporal discovery helper `resourceReferencesCreatedAfter` and `input.mergeCreatedAt` are no longer part of the JS API.

### Later merge chain

Pair unmerge is last-in-first-out for merges into the same target resource. Before computing a plan, MDMbox verifies that the Task's target resource still exists and looks for active merge Tasks into that resource created after the requested Task. If any exist, the response is `409 Conflict`; `OperationOutcome.issue.diagnostics` contains the full chronological Task chain and identifies the latest Task that must be unmerged first.

### Preview and response

For preview, the response is a `Parameters` resource containing `outcome` (`OperationOutcome`) and `plan` (the complete audited transaction Bundle). Preview performs no writes.

For successful execution, the response contains `outcome` and the new unmerge `task`. Warnings do not change the HTTP 200 status. A strict drift conflict returns the `OperationOutcome` directly with HTTP 409 and makes no business changes. Successful AuditEvents commit with the reversal; failed non-preview attempts use a separate best-effort audit write. See [Audit](audit.md). A missing merge Task or deleted original target resource returns `404 Not Found`; unmerge never recreates a deleted target.

Both algorithms execute against a version-protected database snapshot. Restore intentionally discards changes made before that snapshot, but does not overwrite a concurrent write made while it computes or executes its plan: such a conflict returns HTTP 409 and rolls back the restoration and its successful audit together.

Internal storage failures return HTTP 500 with a generic OperationOutcome and no database row diagnostics or payloads. Ordinary transaction validation failures return 422 with FHIR validation details. Both roll back business changes, the new Task, Provenance, and success AuditEvent, and the original merge Task update. A separate failure AuditEvent may still be persisted. This error mapping applies to v2; legacy v1 is unchanged.

Keep the original Task, Provenance, and required FHIR history versions. An edited audit revision cannot substitute for a missing original. Before deleting a resource described as merge-created, MDMbox also requires its recorded creation version from that merge transaction. Missing or inconsistent evidence returns `422 Unprocessable Entity` without partial restoration.

Retention must include the pinned post-merge versions as well as the pre-merge snapshots. If an explicitly recorded version is missing, neither algorithm substitutes another version. Older audits with unversioned mutation targets remain supported through server-side history lookup, provided the necessary original versions still exist; no audit migration is required.

The original merge Task records the source and target history versions plus every `related-resource-type` scope selected by merge v2. This lets unmerge v2 restore a target that the merge algorithm did not modify and report target-referencing resources outside the merge changes even when no resource of that type existed at merge time.

## Client-plan unmerge v1

The original `$unmerge` operation reverses a previous `$merge` by executing a client-provided FHIR transaction Bundle. The client decides exactly how to restore resources; MDMbox validates the referenced merge Task, adds audit resources, flips the original merge Task to `unmerged`, and executes everything atomically.

## How it works

1. The client finds the original merge `Task`.
2. The client reads the merge audit trail with `GET /Provenance?target=Task/<task-id>` and builds a reverse transaction Bundle.
3. The client calls `$unmerge` with the merge Task reference and the reverse plan.
4. MDMbox adds an unmerge `Task`, `Provenance`, and `AuditEvent`, updates the original merge Task to `businessStatus=unmerged`, and executes the Bundle as one transaction.
5. If anything fails, the entire transaction rolls back, including its success audit records and the merge Task status update. A separate best-effort AuditEvent records the failed non-preview attempt.

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

**AuditEvent** records the initiating user or client when available, outcome, service, correlation, and references to the original merge Task, new unmerge Task, Provenance, and domain resources. If this event cannot be written, the reversal rolls back. See [Audit](audit.md) for failure and preview behavior.

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
