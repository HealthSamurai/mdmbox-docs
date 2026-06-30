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

Unversioned routes such as `/api/fhir/Patient/$match` use the FHIR release
selected by `MDMBOX_DEFAULT_FHIR_RELEASE`. Versioned routes are also available
as `/api/fhir/r4/:resource/$match` and `/api/fhir/r6/:resource/$match`.
Instance-level matching is available at
`/api/fhir/r4/:resource/:id/$match` and `/api/fhir/r6/:resource/:id/$match`.

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

### Common request body parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `modelId` | valueString | Yes | ID of the MatchingModel to use |
| `resource` | resource | Only for `/api/fhir/:resource/$match` | The FHIR resource to find matches for. Omit this parameter when matching an existing resource by ID. |
| `threshold` | valueDecimal | No | Override the model's `probable` threshold in normal potential-match mode. Cannot be combined with `onlyCertainMatches`. |
| `count` | valueInteger | No | Maximum number of returned entries (default: 10). `Bundle.total` still reports the full number of matches above the effective threshold. |

The default `count` is controlled by `MDMBOX_MATCH_DEFAULT_COUNT` and is `10`
unless configured otherwise.

### R6 flag behavior

| Name | Type | Description |
| --- | --- | --- |
| `onlyCertainMatches` | valueBoolean | Sets the effective threshold to the model's `certain` threshold. Cannot be combined with `threshold` or `onlySingleMatch`. `count` still applies. |
| `onlySingleMatch` | valueBoolean | Returns one best candidate. Cannot be combined with `threshold`, `count`, or `onlyCertainMatches`. |

In normal R6 mode, MDMbox uses `threshold` when supplied, otherwise the model's
`probable` threshold. There is no 100-entry TEFCA cap for R6.

In R6 `onlySingleMatch=true` mode, MDMbox asks the server-side matching
algorithm to designate one best candidate. If several candidates are eligible,
MDMbox returns the highest-scored one; if scores are tied, MDMbox uses resource
ID as a stable tie-breaker. If no candidate is eligible, the response is an
empty searchset.

### R4 flag behavior

| Name | Type | Description |
| --- | --- | --- |
| `onlyCertainMatches` | valueBoolean | Sets the effective threshold to the model's `certain` threshold. Cannot be combined with `threshold`. `count` still applies. |

R4 routes do not implement `onlySingleMatch`; use an R6 route when that behavior
is required.

In normal R4 potential-match mode (`onlyCertainMatches` omitted or `false`),
MDMbox uses `threshold` when supplied, otherwise the model's `probable`
threshold.

When `MDMBOX_TEFCA_MODE=true`, R4 potential-match responses return no more than
100 entries, even when `count` is larger. The TEFCA cap is not applied when
`onlyCertainMatches=true`.

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
