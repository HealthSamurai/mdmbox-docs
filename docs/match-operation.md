---
description: Use the $match operation to find potential duplicate FHIR resources using probabilistic matching.
---

# Find duplicates: $match

The `$match` operation performs a probabilistic search using a matching model and returns potential duplicates ranked by match score.

A [MatchingModel](matching-models.md) must be created before using `$match`.

MDMbox follows the request and response shape of the FHIR R6
[`Patient/$match`](https://build.fhir.org/patient-operation-match.html)
operation: clients send a FHIR `Parameters` resource and receive a `Bundle` of
type `searchset`. MDMbox generalizes the operation to any configured FHIR
resource type and adds `modelId` and `threshold` parameters so callers can choose
the matching model and score cutoff.

## Match a resource

Send a FHIR Parameters resource containing the record to match:

```http
POST https://<mdmbox-host>/api/fhir/Patient/$match
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
POST https://<mdmbox-host>/api/fhir/Patient/123/$match
Content-Type: application/json
```

```json
{
  "resourceType": "Parameters",
  "parameter": [
    {"name": "modelId", "valueString": "patient-model"}
  ]
}
```

MDMbox retrieves `Patient/123` by ID and uses it as the source resource. The
source resource itself is excluded from the response by ID, so `Patient/123`
will not be returned as its own match.

## Parameters

### Request body parameters (FHIR Parameters)

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `modelId` | valueString | Yes | ID of the MatchingModel to use |
| `resource` | resource | Only for `/api/fhir/:resource/$match` | The FHIR resource to find matches for. Omit this parameter when matching an existing resource by ID. |
| `threshold` | valueDecimal | No | Override the model's `probable` threshold |
| `onlyCertainMatches` | valueBoolean | No | Only return matches above the `certain` threshold |
| `onlySingleMatch` | valueBoolean | No | Return the single most appropriate match |
| `count` | valueInteger | No | Maximum number of results (default: 10) |

The default `count` is controlled by `MDMBOX_MATCH_DEFAULT_COUNT` and is `10`
unless configured otherwise. When `onlyCertainMatches=false`, MDMbox returns no
more than 100 potential matches.

### Flag behavior

`onlyCertainMatches=true` returns only candidates above the model's `certain`
threshold. If `threshold` is also provided, MDMbox uses the stricter of the two
values.

`onlySingleMatch=true` returns the single most appropriate candidate above the
effective `certain` threshold. If more than one candidate passes, MDMbox returns
the highest-scored candidate. If scores are tied, MDMbox uses resource ID as a
stable tie-breaker. If no candidate passes, the response is an empty searchset.
`onlySingleMatch` ignores `count`.

`count` limits the number of returned entries for normal matching and
`onlyCertainMatches=true`. In normal potential-match mode, MDMbox also applies a
100-result safety cap even when `count` is larger.

## Response

The response is a FHIR Bundle of type `searchset`. Each entry includes:

- `resource` — the matched FHIR resource
- `search.score` — probability-like FHIR search score from 0 to 1 derived from
  the raw match weight
- `search.extension` — match grade (`certain`, `probable`, or `possible`), raw
  match weight, and per-feature match details

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
        "score": 0.9998,
        "extension": [
          {
            "url": "http://hl7.org/fhir/StructureDefinition/match-grade",
            "valueCode": "certain"
          },
          {
            "url": "https://mdmbox.health-samurai.io/fhir/StructureDefinition/match-weight",
            "valueDecimal": 12.4
          },
          {
            "url": "https://mdmbox.health-samurai.io/fhir/StructureDefinition/match-details",
            "extension": [
              {"url": "given", "valueDecimal": 4.5},
              {"url": "family", "valueDecimal": 5.1},
              {"url": "birthDate", "valueDecimal": 2.8}
            ]
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

## Weight and score calculation

Match weights are log2 Bayes factor sums. MDMbox exposes the raw weight in the
`https://mdmbox.health-samurai.io/fhir/StructureDefinition/match-weight`
extension and converts it to `search.score` using a sigmoid function:

`probability = 1 / (1 + 2^(-weight))`

See [Mathematical details](mathematical-details.md) for the full derivation.
