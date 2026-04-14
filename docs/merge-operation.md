---
description: Use the $merge operation to merge duplicate FHIR resources with full audit trail and preview support.
---

# Merge operation

The `$merge` operation merges two FHIR resources by executing a client-provided FHIR transaction Bundle. The client controls exactly what changes are made — MDMbox executes them atomically and adds audit records.

## How it works

1. The client identifies a duplicate pair (source and target)
2. The client builds a FHIR transaction Bundle describing the merge (update target, reassign references, delete source)
3. MDMbox validates the request, adds audit resources (Task and Provenance), and executes the Bundle as a single transaction
4. If anything fails, the entire transaction rolls back — including audit records

## Request

```http
POST /api/$merge
Content-Type: application/json
```

```json
{
  "resourceType": "Parameters",
  "parameter": [
    {"name": "source", "valueReference": {"reference": "Patient/duplicate-123"}},
    {"name": "target", "valueReference": {"reference": "Patient/primary-456"}},
    {"name": "preview", "valueBoolean": false},
    {
      "name": "plan",
      "resource": {
        "resourceType": "Bundle",
        "type": "transaction",
        "entry": [
          {
            "request": {"method": "PUT", "url": "Patient/primary-456", "ifMatch": "3"},
            "resource": {
              "resourceType": "Patient",
              "id": "primary-456",
              "name": [{"given": ["John"], "family": "Smith"}],
              "birthDate": "1985-03-20"
            }
          },
          {
            "request": {"method": "PUT", "url": "Encounter/enc-789", "ifMatch": "1"},
            "resource": {
              "resourceType": "Encounter",
              "id": "enc-789",
              "subject": {"reference": "Patient/primary-456"}
            }
          },
          {
            "request": {"method": "DELETE", "url": "Patient/duplicate-123"}
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
| `source` | valueReference | Yes | The resource to be merged away (deleted) |
| `target` | valueReference | Yes | The surviving resource |
| `preview` | valueBoolean | No | If true, return the assembled Bundle without executing (default: false) |
| `plan` | resource (Bundle) | Yes | FHIR transaction Bundle with the merge changes |

### Plan Bundle

The plan is a standard FHIR transaction Bundle. It typically contains:

- A `PUT` entry for the target resource (with updated data)
- `PUT` entries to reassign references from related resources (Encounters, Observations, etc.)
- A `DELETE` entry for the source resource

Use `ifMatch` headers (ETags) for optimistic locking. If a resource was modified between when the client read it and when the merge executes, the entire transaction rolls back with a `422 Unprocessable Entity` response (code `conflict`).

## Preview mode

Set `preview` to `true` to see the assembled Bundle (including audit resources) without executing it:

```json
{
  "resourceType": "Parameters",
  "parameter": [
    {"name": "source", "valueReference": {"reference": "Patient/duplicate-123"}},
    {"name": "target", "valueReference": {"reference": "Patient/primary-456"}},
    {"name": "preview", "valueBoolean": true},
    {"name": "plan", "resource": {"resourceType": "Bundle", "type": "transaction", "entry": []}}
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
        "issue": [{"severity": "information", "code": "informational",
                    "details": {"text": "Merge plan is valid and ready to execute"}}]
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

On success, the response is a Parameters resource containing:

```json
{
  "resourceType": "Parameters",
  "parameter": [
    {
      "name": "outcome",
      "resource": {
        "resourceType": "OperationOutcome",
        "issue": [{"severity": "information", "code": "informational",
                    "details": {"text": "Merge completed: Patient/duplicate-123 -> Patient/primary-456"}}]
      }
    },
    {
      "name": "input-parameters",
      "resource": {
        "resourceType": "Parameters",
        "parameter": [
          {"name": "source", "valueReference": {"reference": "Patient/duplicate-123"}},
          {"name": "target", "valueReference": {"reference": "Patient/primary-456"}},
          {"name": "preview", "valueBoolean": false}
        ]
      }
    },
    {
      "name": "task",
      "resource": {
        "resourceType": "Task",
        "id": "generated-task-id",
        "status": "completed",
        "code": {"coding": [{"code": "merge"}]},
        "businessStatus": {"coding": [{"code": "merged"}]},
        "for": {"reference": "Patient/duplicate-123"},
        "focus": {"reference": "Patient/primary-456"}
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

## Audit trail

Every merge creates two audit resources inside the same transaction:

**Task** — records the merge event:
- `for` — the source (merged away)
- `focus` — the target (survivor)
- `businessStatus` — `merged`
- `code` — `merge`

**Provenance** — records what was changed:
- `entity[]` — versioned references to all affected resources before the merge
- `agent` — `Device/mdmbox-merge`
- `activity` — MDATA (merge data)

These audit resources enable future unmerge by preserving the pre-merge state of every affected resource.

## Validation

MDMbox validates the merge request before execution:

**Structural validation (400 Bad Request):**
- Source and target must be different resources
- Plan must be a transaction Bundle with at least one entry
- No duplicate PUT/DELETE URLs in the plan

**State validation (422 Unprocessable Entity):**
- Both source and target must exist
- Source must not already be merged (no active merge Task)
- Target must not already be a source in another merge (no circular merges)

## Finding related resources

Use the `$referencing` operation to discover resources that reference a given resource. This is useful when building the merge plan — you need to know which Encounters, Observations, etc. point to the source and need to be reassigned.

See [Referencing operation](referencing-operation.md).
