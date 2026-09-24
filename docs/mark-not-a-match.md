---
description: Record that two FHIR records represent different entities and exclude the pair from future matching.
---

# Mark not a match

Use `$mark-not-a-match` after reviewing a candidate pair and deciding that the records represent different people or entities. MDMbox saves the decision as a Task; it does not change either record.

## Request

Both records must exist. Send exactly two distinct `record` references:

```http
POST https://<mdmbox-host>/api/fhir/$mark-not-a-match
Content-Type: application/fhir+json
```

```json
{
  "resourceType": "Parameters",
  "parameter": [
    { "name": "record", "valueReference": { "reference": "Patient/123" } },
    { "name": "record", "valueReference": { "reference": "Patient/456" } },
    { "name": "reason", "valueString": "Different people confirmed during review" }
  ]
}
```

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `record` | valueReference | Exactly two | References to the reviewed records |
| `reason` | valueString or valueCodeableConcept | No | Reason for the decision |
| `note` | valueString | No | Additional review note |
| `reviewTask` | valueReference | No | An existing Task to associate with the decision |

## Response and effect

HTTP 200 returns FHIR `Parameters` with `outcome` (OperationOutcome) and `task` (the saved assertion Task). Repeating the request for the same pair returns the existing Task, even if the records are supplied in the opposite order. It does not update the original reason or note.

- **$match:** excludes this pair when matching a resource with an ID. An anonymous input resource has no pair decision to apply.
- **Bulk and Continuous matching:** keep the scored pair in their results and label it `not-a-match` at export time. Use `?decisionStatus=pending` to export only undecided pairs.
- **Link and merge:** refuse an operation that would link or merge the asserted pair.

To find recorded decisions, query Aidbox:

```http
GET https://<aidbox-host>/fhir/Task?code=mark-not-a-match&business-status=not-a-match
```

The Task's `input` contains the two record references. MDMbox does not currently provide an operation to revoke a not-a-match decision.

## Errors

| Status | Meaning |
| --- | --- |
| 400 | Invalid request, including fewer or more than two records, or the same reference twice |
| 409 | The records are already linked; unlink them before recording this decision |
| 422 | A record or review Task does not exist, or `reviewTask` is not a Task reference |
| 500 | The Task or required audit event could not be saved |

Errors return an OperationOutcome. This operation has no preview mode. A new decision and its AuditEvent are saved together; repeated requests also produce an audit event. See [Audit](audit.md).
