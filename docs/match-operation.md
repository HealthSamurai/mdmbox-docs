---
description: Use $match operation to find potential duplicate records with configurable query parameters and scoring.
---

# Find Duplicates: $match

{% hint style="warning" %}
To use the `$match` operation, you need to set up MDMbox. Read the [Run MDMbox Locally](run-locally.md) guide and [Configuration](configuration.md) to learn how to run and use it.
{% endhint %}

The `$match` operation is used to **find potential duplicate records**.

It performs a probabilistic search based on a **matching model** that compares the record you provide with other records in the system across multiple features and estimates how similar they are. The structure of the matching model and its parameters are described on the [Matching Model Explanation](matching-model.md) page.

The **result is a list of potential duplicates**, each with a calculated match score and a detailed breakdown of feature similarity.

Below we use **Patient** as an example, but the same flow works for any resource type your matching model targets.

This page provides key information about using `$match`. For full API details, refer to the [Swagger documentation](https://dev.mdm.health-samurai.io/backend/static/swagger.html).

## $match

The match operation can be initiated either through the **MDM user interface** or by using the **API**.

The `$match` operation supports several **query parameters** that let you control how matching is performed and how results are returned:

| Name | Type | Default | Description | Example |
| --- | --- | --- | --- | --- |
| `model` | string | `model` | Matching model ID to be used for matching | `model` |
| `threshold` | integer | `0` | Minimum score threshold for a candidate to appear in the match results | `0` |
| `page` | integer | `1` | Page number of results | `1` |
| `size` | integer | `10` | Number of results per page | `10` |

To call the `$match` operation, you have to send a FHIR `Parameters` resource that includes the **record** for which you want to search potential duplicates. Typically, this record contains identifying data such as:

- Name (given and family)
- Address (e.g., city, state)
- Birth date
- Other identifying attributes if available (e.g., telecom, identifiers)

For example, the request can look like this (Patient example):

```http
POST /fhir/Patient/$match?model=model&threshold=10&page=1&size=10
Content-Type: application/json

{
  "resourceType": "Parameters",
  "parameter": [
    {
      "name": "resource",
      "resource": {
        "name": [
          {
            "given": [
              "Freya"
            ],
            "family": "Shah"
          }
        ],
        "address": [
          {
            "city": "London"
          }
        ],
        "birthDate": "1970-12-17"
      }
    }
  ]
}
```

As a result, you will receive the following:

- A **list of candidate duplicate records**
- For each candidate record:
  - `match_weight` — an overall similarity score calculated by the matching model
  - `match_details` — per-feature similarity contributions (e.g., name similarity, date of birth match, address closeness, etc.)
  - `resource` — the full FHIR resource for that candidate

The response is sorted by `match_weight` in descending order so that the most similar records appear first.

For example:

```json
[
  {
    "match_details": {
      "fn": 13.336495228175629,
      "dob": 10.59415069916466,
      "ext": -10.517360697819983,
      "sex": 0
    },
    "match_weight": 13.413285229520307,
    "resource": {
      "id": "236",
      "resourceType": "Patient",
      "name": [
        {
          "given": ["Freya"],
          "family": "Shah"
        }
      ],
      "address": [
        {
          "city": "Londodn"
        }
      ],
      "birthDate": "1970-12-17",
      "identifier": [
        {
          "value": "62",
          "system": "cluster"
        }
      ]
    }
  },
  {
    "match_details": {
      "fn": 13.104401641242227,
      "dob": 10.59415069916466,
      "ext": -10.517360697819983,
      "sex": 0
    },
    "match_weight": 13.181191642586905,
    "resource": {
      "id": "238",
      "resourceType": "Patient",
      "name": [
        {
          "given": ["Shah"],
          "family": "Freya"
        }
      ],
      "address": [
        {
          "city": "London"
        }
      ],
      "telecom": [
        {
          "value": "f.s@flynn.com",
          "system": "email"
        }
      ],
      "birthDate": "1970-12-17",
      "identifier": [
        {
          "value": "62",
          "system": "cluster"
        }
      ]
    }
  }
]
```
