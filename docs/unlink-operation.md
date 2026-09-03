---
description: Use the $unlink operation to reverse a previous link with an auditable transaction.
---

# Unlink operation

The `$unlink` operation reverses a previous `$link`. The client provides a reverse transaction Bundle, usually deleting the profiled `Linkage`; MDMbox validates the original link Task, adds audit resources, flips the original link Task to `unlinked`, and executes everything atomically.

Use `$unlink` when a link cluster was created by mistake or when a client needs to remove records from an MDMbox-managed Linkage.

## How it works

1. The client finds the original link `Task`.
2. The client builds a reverse transaction Bundle, typically deleting the Linkage created by `$link`.
3. The client calls `$unlink` with the link Task reference and the reverse plan.
4. MDMbox adds an unlink `Task`, adds `Provenance`, updates the original link Task to `businessStatus=unlinked`, and executes the Bundle as one transaction.
5. If anything fails, the entire transaction rolls back, including audit records and the link Task status update.

## Request

```http
POST https://<mdmbox-host>/api/fhir/$unlink
Content-Type: application/json
```

```json
{
  "resourceType": "Parameters",
  "parameter": [
    { "name": "task", "valueReference": { "reference": "Task/link-task-123" } },
    { "name": "preview", "valueBoolean": false },
    {
      "name": "plan",
      "resource": {
        "resourceType": "Bundle",
        "type": "transaction",
        "entry": [
          {
            "request": {
              "method": "DELETE",
              "url": "Linkage/linkage-456",
              "ifMatch": "W/\"3\""
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
| `task` | valueReference | Yes | Reference to the original link Task |
| `preview` | valueBoolean | No | If true, return the assembled Bundle without executing (default: false) |
| `plan` | resource (Bundle) | Yes | FHIR transaction Bundle with the reverse changes |

### Plan Bundle

The plan is a standard FHIR transaction Bundle. It usually contains a `DELETE` entry for the Linkage, because the MDM Linkage profile represents active clusters and MDMbox preserves history through the FHIR history API.

Allowed plan methods are `PUT`, `POST`, and `DELETE`. The plan must not contain duplicate `PUT` or `DELETE` URLs.

Use `ifMatch` for optimistic locking. If the Linkage or another resource changed after the client built the reverse plan, the transaction rolls back and `$unlink` returns `422 Unprocessable Entity` with an `OperationOutcome` code such as `conflict`.

## Preview mode

Set `preview` to `true` to validate the request and inspect the assembled transaction without writing anything:

```json
{
  "resourceType": "Parameters",
  "parameter": [
    { "name": "task", "valueReference": { "reference": "Task/link-task-123" } },
    { "name": "preview", "valueBoolean": true },
    {
      "name": "plan",
      "resource": {
        "resourceType": "Bundle",
        "type": "transaction",
        "entry": [
          { "request": { "method": "DELETE", "url": "Linkage/linkage-456" } }
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
            "valueReference": { "reference": "Task/link-task-123" }
          },
          { "name": "preview", "valueBoolean": false }
        ]
      }
    },
    {
      "name": "task",
      "resource": {
        "resourceType": "Task",
        "id": "generated-unlink-task-id",
        "status": "completed",
        "intent": "order",
        "code": { "coding": [{ "code": "unlink" }] },
        "businessStatus": { "coding": [{ "code": "completed" }] },
        "basedOn": [{ "reference": "Task/link-task-123" }]
      }
    }
  ]
}
```

The `input-parameters` echo omits the potentially large `plan` parameter.

## Audit trail

Every executed unlink creates or updates these resources in the same transaction:

**Unlink Task**

- `code` - `unlink`
- `businessStatus` - `completed`
- `basedOn` - the original link Task
- `input[]` - copied from the original link Task when present

**Original link Task**

- `businessStatus` changes from `linked` to `unlinked`
- updated with `ifMatch` using the Task version read during validation

**Provenance**

- `activity` - `unlink` from `http://terminology.hl7.org/CodeSystem/iso-21089-lifecycle`
- `target` - every reverse-plan target plus the unlink Task
- `entity[]` - versioned references to pre-unlink revisions when available
- `agent` - `Device/mdmbox`

After a successful unlink, the same records can be linked again because the previous link Task is no longer active.

## Validation

MDMbox validates the unlink request before execution:

**Structural validation (400 Bad Request):**

- Request body must be a FHIR `Parameters` resource
- `task` is required
- `plan` must be a transaction Bundle with at least one entry
- Plan methods must be `PUT`, `POST`, or `DELETE`
- No duplicate `PUT` or `DELETE` URLs in the plan

**State validation (422 Unprocessable Entity):**

- The referenced Task must exist
- The Task must be a link Task (`code=link`)
- The link Task must still be active (`businessStatus=linked`)

**FHIR transaction validation (422 or 500):**

- If any transaction entry fails validation or optimistic locking, the whole transaction rolls back
- Client-side transaction failures return `422` with an `OperationOutcome`
- Server-side transaction failures return `500`

## See also

{% content-ref %}
[Link operation](link-operation.md)
{% endcontent-ref %}
