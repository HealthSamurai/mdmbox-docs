---
description: Create and configure matching models that define how MDMbox compares FHIR resources to find duplicates.
---

# Matching models

A matching model defines how MDMbox compares records to find duplicates. It specifies which fields to compare, how to compare them, and what scores to assign.

MDMbox supports two types of models:

- **MatchingModel** — for online `$match` queries against individual resources
- **BulkMatchingModel** — shared by Bulk matching jobs and Continuous matching processes

Both are stored as FHIR resources. Manage `MatchingModel` through MDMbox REST endpoints, and `BulkMatchingModel` through the Admin UI or the [Aidbox FHIR API](https://www.health-samurai.io/docs/aidbox/api/rest-api/crud).

## Save a trained model

**Available from:** `edge`.

In **Models → Model builder**, prepare the data and features, review **Training** and **Blocks**, then open **Validation**. Enter a unique **Model ID** and select **Save model**. Every comparison case and Else level must have an estimated weight. A feature with missing weights must be trained or removed before saving.

The saved `MatchingModel` contains the field transformations, comparison cases, weights, thresholds, and derived matching blocks. Missing values retain a weight of zero. Use its ID as `modelId` in a [$match request](match-operation.md). Saving a model does not copy the training records into the live resource database.

Models saved by Model builder use `"executionEngine": "duckdb"`. Their expressions run in DuckDB against current committed records in MDMbox's configured PostgreSQL database. This preserves DuckDB comparison behavior, including `levenshtein` and `jaro_winkler_similarity`, without requiring those functions in PostgreSQL. Soundex uses the same definition during training and matching. Scalar fields, lists, built-in SQL transformations, and custom SQL transformations are saved with the model; Double Metaphone variants are currently unsupported for live matching and must be removed from the features before saving. Rebuild tables created before transformation snapshots were supported if they use custom transformations.

`executionEngine` is optional. Omit it or use `"postgres"` for existing PostgreSQL models. Write expressions in the selected engine's SQL dialect. DuckDB models are for online `$match`; Bulk matching and Continuous matching still use `BulkMatchingModel`.

DuckDB matching requires the official DuckDB `postgres` extension, included in the MDMbox Docker image. When running outside that image, MDMbox loads the extension from the local cache and installs it from DuckDB's extension repository if absent; provision the cache before running without outbound network access. Each request opens a read-only PostgreSQL attachment and computes its result from the request's database snapshot; it does not participate in another connection's uncommitted transaction. DuckDB expressions can require scanning and transferring candidate data from PostgreSQL, so a PostgreSQL expression index does not automatically accelerate them.

### Accelerate DuckDB matching

For DuckDB models, MDMbox can filter candidates in PostgreSQL before evaluating comparisons in DuckDB. This currently supports equality blocks on variables written as `json_extract_string(#.resource, '$.birthDate')`, including nested paths such as `$.name[0].given[0]`. Use a `variable` block with the default equality operator, or SQL containing `l.#dob = r.#dob` and conjunctions of such equalities. Every OR branch must be supported. Input values must be strings or missing. Other expressions, including fuzzy-only blocks, cleanup functions and the builder's `json_transform` expressions, retain the full scan.

For a variable extracting `$.birthDate`, create this expression index in the resource database:

```sql
CREATE INDEX CONCURRENTLY patient_duckdb_birth_date_idx ON public.patient
((CASE WHEN jsonb_typeof(resource #> ARRAY['birthDate']) <> 'string'
       THEN ''
       ELSE resource #>> ARRAY['birthDate'] END));
```

Use the complete expression: a plain index on `resource->>'birthDate'` does not match this filter. The filter retains non-string JSON values for checking in DuckDB, so it cannot discard a match because the engines serialize those values differently. Original blocks and comparisons still run in DuckDB. Indexes are created by the database operator, not during `$match`; they consume storage and add work to writes.

## Concepts

### Variables

Variables extract values from FHIR resources using SQL expressions. They are referenced by blocks and features. The examples below use the default PostgreSQL engine.

The normalization examples use canonical `mdm_` names. If your installation only has [legacy names](sql-functions.md#legacy-names), use the corresponding function, such as `immutable_unaccent_upper` for `mdm_unaccent_upper`.

```json
{
  "variable": [
    { "name": "dob", "expression": "(#.resource->>'birthDate')" },
    {
      "name": "family",
      "expression": "mdm_unaccent_upper(#.resource->'name'->0->>'family')"
    }
  ]
}
```

The `#` prefix is replaced with the table alias at query time (`l.` for the left record, `r.` for the right).

`public.mdm_unaccent_upper(text)` removes accents, converts text to uppercase, and preserves SQL `NULL`. Wrap it in `btrim(...)` to ignore surrounding spaces. See [SQL functions](sql-functions.md#normalization-helpers) for all normalization helpers, examples, and handling of empty values.

### Blocks

Blocks define how candidate pairs are selected before comparison. Each block is a condition that narrows the search space. Blocks are combined with OR — a pair only needs to match one block.

```json
{
  "block": [
    { "name": "dob", "variable": "dob" },
    { "name": "fn", "variable": "family" }
  ]
}
```

A block with `"variable": "dob"` means "candidates must have the same date of birth". For custom logic, use `"sql"` instead of `"variable"`:

```json
{ "name": "custom", "sql": "l.some_column = r.some_column" }
```

### Features

Features define the comparison logic. Each feature has a list of cases evaluated top to bottom. The first matching case determines the weight (log2 Bayes factor).

```json
{
  "feature": [
    {
      "name": "dob",
      "case": [
        { "expression": "l.#dob = r.#dob", "weight": 10.59 },
        { "expression": "levenshtein(l.#dob, r.#dob) <= 1", "weight": 3.99 },
        { "else": -10.32 }
      ]
    }
  ]
}
```

The total match score is the sum of all feature weights.

See [SQL functions](sql-functions.md) for Jaro–Winkler, edit distance, phonetic codes, and trigram comparisons available to feature expressions.

### Thresholds

Thresholds classify match results into grades:

```json
{
  "thresholds": {
    "certain": 25,
    "probable": 16
  }
}
```

- Score >= `certain` — match grade `certain` (high confidence)
- Score >= `probable` — match grade `probable` (review recommended)
- Score < `probable` — match grade `possible` (returned when using a lower threshold or R6 `onlySingleMatch`)

## MatchingModel

Used by the `$match` operation for online queries. Works directly against FHIR resource JSONB columns.

### Create a model

```http
POST https://<mdmbox-host>/api/models
Content-Type: application/json
```

```json
{
  "resourceType": "MatchingModel",
  "id": "patient-model",
  "resource": "Patient",
  "thresholds": {
    "certain": 25,
    "probable": 16
  },
  "variable": [
    { "name": "dob", "expression": "(#.resource->>'birthDate')" },
    {
      "name": "given",
      "expression": "mdm_unaccent_upper(#.resource->'name'->0->'given'->>0)"
    },
    {
      "name": "family",
      "expression": "mdm_unaccent_upper(#.resource->'name'->0->>'family')"
    },
    { "name": "gender", "expression": "(#.resource->>'gender')" }
  ],
  "block": [
    { "name": "dob", "variable": "dob" },
    { "name": "fn", "variable": "family" }
  ],
  "feature": [
    {
      "name": "dob",
      "case": [
        { "expression": "l.#dob = r.#dob", "weight": 10.59 },
        { "expression": "levenshtein(l.#dob, r.#dob) <= 1", "weight": 3.99 },
        { "else": -10.32 }
      ]
    },
    {
      "name": "name",
      "case": [
        {
          "expression": "l.#given = r.#given AND l.#family = r.#family",
          "weight": 13.34
        },
        {
          "expression": "l.#given = r.#family AND l.#family = r.#given",
          "weight": 13.1
        },
        { "expression": "l.#family = r.#family", "weight": 2.4 },
        { "else": -12.37 }
      ]
    },
    {
      "name": "sex",
      "case": [
        { "expression": "l.#gender = r.#gender", "weight": 1.85 },
        { "else": -4.84 }
      ]
    }
  ]
}
```

### Model CRUD

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/models` | List all models (optional `?resource=Patient`) |
| `POST` | `/api/models` | Create a model |
| `GET` | `/api/models/:id` | Get model by ID |
| `PUT` | `/api/models/:id` | Update model |
| `DELETE` | `/api/models/:id` | Delete model |

## BulkMatchingModel

Defines columns, blocks, features, and thresholds for both [Bulk matching](bulk-match.md) jobs and [Continuous matching](continuous-matching.md) processes.

Create and update these resources through Aidbox's FHIR API, or use the MDMbox Admin UI:

```http
PUT https://<aidbox-host>/fhir/BulkMatchingModel/patient-bulk
Content-Type: application/fhir+json
```

Key differences from MatchingModel:

- `column` replaces `variable` — each column has a `source` SQL expression and a PostgreSQL `type`
- `tableName` specifies the flat table to create
- `index` defines indexes to create on the flat table after population
- In `block` entries, `variable` refers to a `column` name (not a variable — the field name is the same in both model types)
- In `feature` expressions, reference column names directly (e.g., `l.dob` instead of `l.#dob`)

```json
{
  "resourceType": "BulkMatchingModel",
  "id": "patient-bulk",
  "resource": "Patient",
  "tableName": "mdm.patient_flat",
  "thresholds": {
    "certain": 23,
    "probable": 16
  },
  "column": [
    { "name": "dob", "type": "text", "source": "resource->>'birthDate'" },
    {
      "name": "family",
      "type": "text",
      "source": "mdm_unaccent_upper(resource->'name'->0->>'family')"
    }
  ],
  "index": [
    { "name": "idx_dob", "column": "dob", "type": "btree" },
    { "name": "idx_family", "column": "family", "type": "btree" }
  ],
  "block": [
    { "name": "dob", "variable": "dob" },
    { "name": "fn", "variable": "family" }
  ],
  "feature": [
    {
      "name": "dob",
      "case": [
        { "expression": "l.dob = r.dob", "weight": 10.59 },
        { "else": -10.32 }
      ]
    },
    {
      "name": "family",
      "case": [
        { "expression": "l.family = r.family", "weight": 13.34 },
        { "else": -12.37 }
      ]
    }
  ]
}
```

## Admin UI

In the Admin UI at `/mdmbox/admin` on the Aidbox address, select a model in **Models** to edit its JSON, or choose **New Model** to create one. A **bulk** badge identifies BulkMatchingModel resources. Check the resource type before saving or deleting: the two model types can share an ID.

## Tuning

The example weights above are for demonstration. Production deployment requires calibrating weights based on your data. Key considerations:

- **Bayes factors** reflect the discriminative power of each comparison. Higher absolute values mean the feature is more decisive.
- **Thresholds** control the tradeoff between precision and recall. Lower thresholds catch more duplicates but increase false positives.
- **Blocks** determine which pairs are compared. Too broad blocks slow down matching; too narrow blocks miss duplicates.
- **Database indexes** are critical for performance with large datasets. Create indexes on columns used in blocks.

{% hint style="info" %}
Professional tuning services are available. Contact [Health Samurai](https://www.health-samurai.io/company#contact-form) for assistance with model calibration using machine learning and expert analysis.
{% endhint %}

## Next steps

{% content-ref %}
[Find duplicates: $match](match-operation.md)
{% endcontent-ref %}

{% content-ref %}
[Bulk matching](bulk-match.md)
{% endcontent-ref %}

{% content-ref %}
[Mathematical details](mathematical-details.md)
{% endcontent-ref %}
