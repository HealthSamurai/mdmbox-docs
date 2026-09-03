---
description: Use the $link operation to create or extend audited FHIR Linkage clusters.
---

# Link operation

The `$link` operation links related FHIR resources without merging their data.
The client provides a FHIR transaction Bundle that creates or patches a profiled
`Linkage`; MDMbox validates cluster membership (one external record can belong
to only one active MDM Linkage), adds audit resources, and executes the Bundle
atomically.

Use `$link` when records should remain separate resources but should be tracked
as belonging to the same identity cluster or review decision.

## How it works

1. The client decides which records belong in a link cluster.
2. The client builds a transaction Bundle that creates or patches a profiled
   `Linkage`.
3. If needed, the client includes a contained golden view in the Linkage: a
   client-built canonical view of the linked records.
4. MDMbox validates that linked records do not already belong to another active
   profiled Linkage.
5. MDMbox adds a link `Task` and `Provenance`, then executes the Bundle as one
   transaction.
6. If anything fails, the entire transaction rolls back, including audit
   records.

## Request

```http
POST https://<mdmbox-host>/api/fhir/$link
Content-Type: application/json
```

```json
{
  "resourceType": "Parameters",
  "parameter": [
    {"name": "preview", "valueBoolean": false},
    {
      "name": "plan",
      "resource": {
        "resourceType": "Bundle",
        "type": "transaction",
        "entry": [
          {
            "fullUrl": "urn:uuid:11111111-1111-1111-1111-111111111111",
            "request": {"method": "POST", "url": "Linkage"},
            "resource": {
              "resourceType": "Linkage",
              "meta": {
                "profile": [
                  "https://mdm.health-samurai.io/fhir/StructureDefinition/mdm-linkage"
                ]
              },
              "active": true,
              "item": [
                {"type": "source", "resource": {"reference": "Patient/golden"}},
                {"type": "alternate", "resource": {"reference": "Patient/duplicate"}}
              ]
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
| `preview` | valueBoolean | No | If true, return the assembled Bundle without executing (default: false) |
| `plan` | resource (Bundle) | Yes | FHIR transaction Bundle that creates or patches a profiled Linkage |

### Linkage profile

New Linkage resources must include this profile:

```text
https://mdm.health-samurai.io/fhir/StructureDefinition/mdm-linkage
```

The Linkage is expected to be active. MDMbox uses the profile namespace when
checking whether a resource is already linked.

### Plan Bundle

The plan must be a transaction Bundle and must create or patch at least one
`Linkage`.

Allowed methods:

- `POST` - create a profiled Linkage
- `PATCH` - extend an existing profiled Linkage using FHIRPath Patch

Forbidden methods:

- `PUT`
- `DELETE`

`PATCH` entries must use a FHIRPath Patch `Parameters` resource, and each
operation must be `add` or `insert`. Destructive patch operations are rejected.

### Golden view

A Linkage may include a contained "golden view" resource: a client-built
canonical view of the linked records stored inside `Linkage.contained`. The
Linkage then references it with a local contained reference such as `#golden`:

```json
{
  "resourceType": "Linkage",
  "contained": [
    {
      "resourceType": "Patient",
      "id": "golden",
      "name": [{"given": ["John"], "family": "Smith"}]
    }
  ],
  "item": [
    {"type": "source", "resource": {"reference": "#golden"}},
    {"type": "alternate", "resource": {"reference": "Patient/pat-1"}},
    {"type": "alternate", "resource": {"reference": "Patient/pat-2"}}
  ]
}
```

The contained golden view is not a separate persisted FHIR resource. MDMbox
does not count `#golden` in cluster membership checks and does not include it in
the audit Task input.

## Search

If you know the `Linkage.id`, retrieve the MDM Linkage and its Patient members:

```http
GET https://<aidbox-host>/fhir/Linkage?_id=linkage-123&_profile=https://mdm.health-samurai.io/fhir/StructureDefinition/mdm-linkage&_include=Linkage:item:Patient
Accept: application/json
```

To include resources that reference those Patients, add standard FHIR
`_revinclude:iterate` parameters:

```http
GET https://<aidbox-host>/fhir/Linkage?_id=linkage-123&_profile=https://mdm.health-samurai.io/fhir/StructureDefinition/mdm-linkage&_include=Linkage:item:Patient&_revinclude:iterate=Encounter:subject:Patient
Accept: application/json
```

If you do not know the `Linkage.id`, search Linkage by a known member reference
and the MDM Linkage profile:

```http
GET https://<aidbox-host>/fhir/Linkage?item=Patient/pat-1&_profile=https://mdm.health-samurai.io/fhir/StructureDefinition/mdm-linkage
Accept: application/json
```

Use the returned `Linkage.id` as the cluster id for follow-up searches.

To retrieve the whole cluster and its Encounters without a separate Linkage
lookup, combine the same profile and member filters with includes:

```http
GET https://<aidbox-host>/fhir/Linkage?item=Patient/pat-1&_profile=https://mdm.health-samurai.io/fhir/StructureDefinition/mdm-linkage&_include=Linkage:item:Patient&_revinclude:iterate=Encounter:subject:Patient
Accept: application/json
```

## Preview mode

Set `preview` to `true` to validate the link plan and inspect the assembled
transaction:

```json
{
  "resourceType": "Parameters",
  "parameter": [
    {"name": "preview", "valueBoolean": true},
    {
      "name": "plan",
      "resource": {
        "resourceType": "Bundle",
        "type": "transaction",
        "entry": ["... Linkage POST or PATCH entries ..."]
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
        "issue": [{"severity": "information", "code": "informational"}]
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

Preview does not persist the Linkage, Task, or Provenance.

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
        "issue": [{"severity": "information", "code": "informational"}]
      }
    },
    {
      "name": "input-parameters",
      "resource": {
        "resourceType": "Parameters",
        "parameter": [
          {"name": "preview", "valueBoolean": false}
        ]
      }
    },
    {
      "name": "task",
      "resource": {
        "resourceType": "Task",
        "id": "generated-link-task-id",
        "status": "completed",
        "intent": "order",
        "code": {"coding": [{"code": "link"}]},
        "businessStatus": {"coding": [{"code": "linked"}]},
        "input": [
          {"type": {"text": "linked-record"}, "valueReference": {"reference": "Patient/golden"}},
          {"type": {"text": "linked-record"}, "valueReference": {"reference": "Patient/duplicate"}}
        ]
      }
    }
  ]
}
```

The `input-parameters` echo omits the potentially large `plan` parameter.

## Audit trail

Every executed link creates audit resources in the same transaction:

**Task**
- `code` - `link`
- `businessStatus` - `linked`
- `input[]` - linked external record references

**Provenance**
- `activity` - `link` from
  `http://terminology.hl7.org/CodeSystem/iso-21089-lifecycle`
- `target` - the Linkage plan targets plus the link Task
- `entity[]` - pre-change revisions for patched Linkages when available
- `agent` - `Device/mdmbox`

## Unlink

A completed link can be reversed with `$unlink`. The unlink request points to
the original link Task and supplies a client-built reverse transaction Bundle,
usually deleting the profiled Linkage. MDMbox executes that reverse plan
atomically, creates its own audit Task and Provenance, and updates the original
link Task to `businessStatus=unlinked`.

See [Unlink operation](unlink-operation.md).

## Validation

MDMbox validates the link request before execution:

**Structural validation (400 Bad Request):**
- Request body must be a FHIR `Parameters` resource
- `plan` must be a transaction Bundle with at least one entry
- The plan must create or patch at least one Linkage
- Linkage `POST` entries must include the MDM Linkage profile
- Plan methods must be `POST` or `PATCH`
- FHIRPath Patch entries may only use `add` or `insert`

**State validation (409 Conflict or 422 Unprocessable Entity):**
- A PATCH target must already carry the MDM Linkage profile (`422`)
- A record must not join multiple active Linkages inside the same plan (`409`)
- A record must not already belong to another active profiled Linkage (`409`)

**FHIR transaction validation (422 or 500):**
- If FHIR validation or persistence fails, the whole transaction rolls back
- Client-side transaction failures return `422` with an `OperationOutcome`
- Server-side transaction failures return `500`

## See also

{% content-ref %}
[Unlink operation](unlink-operation.md)
{% endcontent-ref %}

{% content-ref %}
[Merge operation](merge-operation.md)
{% endcontent-ref %}
