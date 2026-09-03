---
description: Use the $referencing operation to find all FHIR resources that reference a given resource.
---

# Referencing operation

The `$referencing` operation finds all FHIR resources in the database that reference a given resource. This is useful when preparing a merge plan — you need to know which related resources (Encounters, Observations, etc.) need their references updated.

## Request

```http
POST https://<mdmbox-host>/api/fhir/Patient/123/$referencing
Content-Type: application/json
```

```json
{
  "resourceType": "Parameters",
  "parameter": [
    { "name": "type", "valueString": "Encounter" },
    { "name": "type", "valueString": "Observation" },
    { "name": "count", "valueInteger": 50 },
    { "name": "offset", "valueInteger": 0 }
  ]
}
```

### Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | valueString | No | Resource types to search (repeatable). If omitted, searches all types. |
| `count` | valueInteger | No | Maximum results per type (default: 100) |
| `offset` | valueInteger | No | Pagination offset (default: 0) |

## Response

A FHIR Bundle containing all resources that reference the target:

```json
{
  "resourceType": "Bundle",
  "type": "searchset",
  "total": 3,
  "entry": [
    {
      "resource": {
        "resourceType": "Encounter",
        "id": "enc-1",
        "subject": { "reference": "Patient/123" }
      }
    },
    {
      "resource": {
        "resourceType": "Observation",
        "id": "obs-1",
        "subject": { "reference": "Patient/123" }
      }
    }
  ]
}
```

## See also

{% content-ref %}
[Merge operation](merge-operation.md)
{% endcontent-ref %}
