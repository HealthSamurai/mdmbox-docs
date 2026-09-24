---
description: Find resources of selected types that reference a given FHIR resource.
---

# Referencing operation

The `$referencing` operation finds resources that reference a given record. Specify which resource types to search, such as Encounter and Observation. Use the results when building a [merge plan](merge-operation.md#client-plan-merge).

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
| `type` | valueString | Yes, to get results | Resource types to search. Repeat once per type. Omitting all types returns an empty Bundle. |
| `count` | valueInteger | No | Maximum results across all requested types (default: 20) |
| `offset` | valueInteger | No | Pagination offset (default: 0) |

## Response

A FHIR searchset Bundle contains the requested page, ordered by resource type and ID. Increase `offset` by `count` to read the next page. Resource bodies below are abbreviated:

```json
{
  "resourceType": "Bundle",
  "type": "searchset",
  "total": 2,
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

## Audit

Every successful `$referencing` records an AuditEvent naming the subject and returned resources before sending the response. If the event cannot be persisted, the operation returns HTTP 500 instead of the results. See [Audit](audit.md) for failure handling and the 1000-reference recording limit.

## See also

{% content-ref %}
[Merge operation](merge-operation.md)
{% endcontent-ref %}
