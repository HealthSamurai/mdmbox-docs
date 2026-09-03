---
description: Use the $unmerge operation to reverse a previous merge with an auditable transaction.
---

# Unmerge operation

The `$unmerge` operation reverses a previous `$merge` by executing a client-provided FHIR transaction Bundle. The client decides exactly how to restore resources; MDMbox validates the referenced merge Task, adds audit resources, flips the original merge Task to `unmerged`, and executes everything atomically.

Use `$unmerge` when a merge was accepted by mistake and the affected resources must be restored or reassigned.

## How it works

1. The client finds the original merge `Task`.
2. The client reads the merge audit trail, usually the `Provenance` referenced by `Task.relevantHistory`, and builds a reverse transaction Bundle.
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
