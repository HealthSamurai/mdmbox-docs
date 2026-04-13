---
description: Use the $match operation to find potential duplicate FHIR resources using probabilistic matching.
---

# Find duplicates: $match

The `$match` operation performs a probabilistic search using a matching model and returns potential duplicates ranked by match score.

{% hint style="warning" %}
A MatchingModel must be created before using `$match`. See [Matching models](matching-models.md).
{% endhint %}

## Match a resource

Send a FHIR Parameters resource containing the record to match:

```http
POST /api/fhir/Patient/$match
Content-Type: application/json
```

```json
{
  "resourceType": "Parameters",
  "parameter": [
    {"name": "modelId", "valueString": "patient-model"},
    {
      "name": "resource",
      "resource": {
        "resourceType": "Patient",
        "name": [{"given": ["Freya"], "family": "Shah"}],
        "birthDate": "1990-01-15",
        "gender": "female"
      }
    }
  ]
}
```

## Match an existing resource by ID

To match an existing resource against all others:

```http
POST /api/fhir/Patient/123/$match?model-id=patient-model
```

No request body is needed -- MDMbox retrieves the resource by ID and runs the match.

## Parameters

### Request body parameters (FHIR Parameters)

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `modelId` | valueString | Yes | ID of the MatchingModel to use |
| `resource` | resource | Yes | The FHIR resource to find matches for |
| `threshold` | valueDecimal | No | Override the model's `probable` threshold |
| `onlyCertainMatches` | valueBoolean | No | Only return matches above the `certain` threshold |
| `onlySingleMatch` | valueBoolean | No | Return at most one result (empty if ambiguous) |
| `count` | valueInteger | No | Maximum number of results (default: 10) |

### Query parameters (for by-ID match)

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `model-id` | string | -- | MatchingModel ID (required) |
| `threshold` | number | model's `probable` | Minimum score threshold |
| `page` | integer | 1 | Page number |
| `size` | integer | 20 | Results per page |

## Response

The response is a FHIR Bundle of type `searchset`. Each entry includes:

- `resource` -- the matched FHIR resource
- `search.score` -- probability (0 to 1) derived from the match weight
- `search.extension` -- match grade (`certain`, `probable`, or `possible`)

```json
{
  "resourceType": "Bundle",
  "type": "searchset",
  "total": 3,
  "entry": [
    {
      "resource": {
        "resourceType": "Patient",
        "id": "456",
        "name": [{"given": ["Freya"], "family": "Shah"}],
        "birthDate": "1990-01-15"
      },
      "search": {
        "mode": "match",
        "score": 0.99,
        "extension": [
          {
            "url": "http://hl7.org/fhir/StructureDefinition/match-grade",
            "valueCode": "certain"
          }
        ]
      }
    }
  ]
}
```

{% hint style="warning" %}
For large datasets, create database indexes on columns used in matching model blocks. Without indexes, `$match` performs a full table scan for each block, which can be very slow.
{% endhint %}

## Score calculation

Match scores are log2 Bayes factor sums, converted to probabilities using a sigmoid function:

`probability = 1 / (1 + 2^(-weight))`

A weight of 25 corresponds to a probability of ~0.99999997. See [Mathematical details](mathematical-details.md) for the full derivation.
