---
description: Create and configure matching models that define how MDMbox compares FHIR resources to find duplicates.
---

# Matching models

A matching model defines how MDMbox compares records to find duplicates. It specifies which fields to compare, how to compare them, and what scores to assign.

MDMbox supports shared scoring models and the existing FHIR model resources:

- **MatchingModel** — for online `$match` queries against individual resources
- **BulkMatchingModel** — shared by Bulk matching jobs and Continuous matching processes
- **Shared scoring model** — a model saved by Model builder, usable by `$match`, Bulk matching and Continuous matching with the same ID

`MatchingModel` and `BulkMatchingModel` are stored as FHIR resources. Their existing APIs and JSON formats remain supported. Shared scoring models use the [shared model API](#shared-model-api) and appear in the Models, Bulk matching and Continuous matching screens.

## Model builder preview

**Available from:** `edge`.

In **Models → Model builder**, follow **Data → Learning → Validation**. Use Data to profile Patient records and build a table of selected fields. In Learning, select **Train automatically** to choose blocking keys and train comparisons without writing code. For manual candidate selection, open **JavaScript comparisons and rule based models → Configure candidate rules**, then return to Learning. Each code result or error appears below the executed block. In Validation, select **Run validation** to check the prepared population, inspect scores and choose thresholds, then select **Save model**.

Use Ctrl+Enter (⌘+Enter on a Mac) to run the current block or selection, or Ctrl+Shift+Enter to run all blocks in order. Running a block again replaces its previous output. Outputs can be collapsed or cleared and are separate from your saved code. After editing code, taking a new sample or restarting the session, outputs are marked as outdated: run the relevant blocks again before relying on them. **Restart** stops running code and clears the session's definitions; run the blocks again to restore them.

Use the saved ID as `modelId` in a [$match request](match-operation.md) or select it in Bulk matching and Continuous matching. The model contains the selected fields, comparison definition, blocking rules and thresholds. Saving a changed definition creates an immutable version; saving the same definition again retains the version. Existing Bulk jobs and automatically resumed Continuous processes keep their original definition. An explicit Continuous Start or Resume uses the latest model and rebuilds when it changed.

If the table was rebuilt after the comparison was prepared, saving returns an error in Validation. Take a new Learning sample, run the code again and review the thresholds before saving.

Scalar fields, filtered lists, cleanup steps, date variants and custom SQL transformations can be selected on the Data step. Learning and live matching use the saved JavaScript comparison definition. Online `$match` reads current committed resources; Bulk jobs use their own prepared snapshot, and Continuous matching keeps its comparison data current asynchronously. All three are independent of the Builder's training tables and later edits to the transformation library.

Write custom Data-step transformations as one PostgreSQL expression over `value` and, when needed, an integer `n`, for example `substr(value, 1, n)`. Table queries, additional statements and arbitrary function calls are rejected. In Learning, the editor provides `jaroWinkler`, `levenshtein` and `isPlaceholder` for JavaScript comparisons.

### Automatic training and JavaScript extensions

**Available from:** `edge`.

**Train automatically** replaces the candidate rules with automatically selected exact keys, builds their indexes, loads a reproducible sample and creates the comparison named `automatic`. Select it in Validation. At least three single-value source fields are required. If no affordable key or independent training session is available, the builder reports the field or preparation problem; add useful fields, use **Configure candidate rules** or write a JavaScript comparison. Manual candidate rules are optional and are not a separate step in the automatic workflow.

The builder chooses comparison levels from available source type metadata, field names and paths, and the content of an unlabeled sample. The training summary records each field's selected profile and the evidence used to select it.

| Field profile | Automatic comparisons |
| --- | --- |
| Dates | Equivalent formats, day/month swap, one-day difference, same year and month, same month and day, and same year |
| Names | Accent differences, reordered words, edit similarity, Jaro–Winkler, token overlap and English Soundex |
| Addresses | Reordered words and string similarity; different explicit leading house numbers prevent fuzzy agreement |
| Phones | Formatting, an extra country prefix and a one-character edit |
| Email | A domain typo with the same mailbox, or a mailbox typo with the same domain; a common domain alone is insufficient |
| Identifiers and postal codes | Formatting and a one-character edit; leading zeros remain significant |
| Categorical fields | Exact equality |
| Numeric values | Equivalent numeric representations and small relative differences |

Every profile starts with normalized exact equality, and its levels are mutually exclusive. Recognized date fields always include day/month swaps, including when the swapped representation has an invalid month but corresponds to a valid calendar date. ISO dates, compact `YYYYMMDD` dates and separated day-first or month-first dates are supported. For separated dates, unambiguous values determine the order; an entirely ambiguous sample defaults to day-first. Normalize ambiguous source formats on Data when their meaning is known. Unknown text fields use the general string comparisons.

Derived variants do not contribute a second independent weight for the same field. The builder estimates weights and the match prior without reviewed labels. These are model estimates; inferred types, correlated fields and errors affecting every blocking key can still cause incorrect or missed matches. Automatic blocking currently uses exact equality, so pairs differing on every selected key are excluded. Inspect Validation before using the model.

To extend an automatically generated comparison, run a sample block after preparing the keys, then add named conditions for the selected field:

```javascript
const compare = autoTrain({
  extensions: {
    given: {
      initials: (a, b) => a.given[0] === b.given[0]
    }
  }
})
```

Conditions run after exact equality and before the built-in fuzzy levels. They must be self-contained functions of two records, using ordinary JavaScript and the provided helpers. Saving checks that the comparison can run independently of the editor session. A condition referring to an external variable or user-defined helper must include that logic within its function.

You can also write the complete comparison as a rule based function:

```javascript
const myRules = (a, b) => ({
  score: a.phone && a.phone === b.phone ? 1 : 0,
  meta: { reason: "phone agreement" }
})
```

Select `myRules` in Validation to inspect, compare and save it through the same workflow. A rule based score must be between 0 and 1 and is not necessarily a calibrated probability. Custom rules use the configured candidate keys, so evaluate their blocking coverage as well as their decisions.

### AI assistant

Configure [OpenAI or Anthropic](config-reference.md#ai-assistant) on the server, select a provider in Learning, and ask for a feature, an explanation or a code review. If configuration is incomplete, **Missing environment variables** lists only the unset variables for the selected provider. The assistant receives your messages, editor code, field names, blocking rules and aggregate sample counts. Sample Patient records and REPL results are excluded. Values you type into a message or include in code are sent as part of that text.

Hide the assistant to expand the editor, then reopen it from the right edge. Hiding it preserves the conversation and unsent message. The navigation control in the bottom-left corner offers **Expanded**, **Collapsed** and **Expand on hover** modes. Both layout preferences are saved in your browser.

Review suggested code before inserting it or replacing the editor. Replacement is blocked if you have edited the code since asking; request an updated suggestion or insert the needed block. Run the code in the REPL and inspect Validation before saving a model. Chat proposals do not run or publish automatically. The conversation lasts for the open page and is cleared on reload.

### Training data

**Profile Patient records** profiles a sample of current Patient records. **Build table** copies the selected fields into the training table. Source changes after building do not update that table; profile and build again to use newer records. You can reopen Model builder to follow a running preparation job on the same MDMbox instance.

**Max values per Patient** is the largest number of values observed for a field in the profile sample or for a column in the built table. A maximum of `1` means no observed Patient had more than one value; use **Filled** to see how often the field or column has a value.

Choose the Learning sample in the first JavaScript block:

```javascript
sample({ records: 2000, random: 10000, confident: 5000, seed: 42 })
```

`records` selects records whose candidates are looked up across the prepared table; `random` selects records for random-pair comparisons; `confident` selects pairs from the Data-step duplicate nets. Each size accepts 1 to 100,000. The seed accepts a whole number from 0 to 2,147,483,647. Repeating a recipe on the same prepared table selects the same data; change the seed to explore another sample. Omitting the seed selects a new one. The block shows the actual sizes, seed and population version. Later blocks wait until the data is loaded. Existing drafts receive a default sample block above their original code.

Learning keeps at most 200 candidates per selected record and blocking rule, and reports when that limit is reached. Confident pairs are rule-selected examples, not independently verified matches. Use Learning for experiments; Validation checks all candidates without that limit.

During preparation, Model builder shows the current stage and elapsed time. Steps with measurable counters show completed work and a percentage; other steps show activity without a percentage or remaining-time estimate. A completed stage does not mean the entire preparation has finished.

Prepared profiles, transformations and tables survive normal MDMbox restarts. If PostgreSQL crash recovery clears the rebuildable training data, profile and build again; saved transformations remain available. Use one MDMbox instance for Model builder jobs when replicas share a database; running jobs and their status belong to the instance that started them.

By default, the builder uses MDMbox's configured database. To use another PostgreSQL source and training workspace, set [`MDMBOX_MODEL_BUILDER_JDBC_URL`](config-reference.md#model-builder). Saved models and live matching use MDMbox's configured database.

### Interpreting Validation

Select **Run validation** to score every distinct candidate pair under the blocking rules across the full prepared table. Progress shows processed records and scored pairs. **Stop** or switching to another Model builder step stops further processing after the current portion; a stopped or failed run keeps the previous completed report visible. The first run can take longer while comparison code is initialized; total time depends on candidate volume and comparison cost.

Completed results show exact record and candidate counts, the score distribution, and paginated pairs with field values and comparison explanations. Changing thresholds reuses the computed scores. The chart groups probability scores in steps of 0.005, or probabilistic model weights in steps of 0.1; weights outside −100 to +100 share the end bins. Decision counts use the original scores, without chart rounding.

These counts describe model decisions. They are not measured precision or recall: determining errors requires independently reviewed reference pairs, including a search for matches excluded by blocking. A run covers the prepared population, not source edits made after **Build table**. After changing Learning code, its sample or the blocking rules, run Validation again before saving the changed comparison.

#### Reopen Validation

**Available from:** `edge`.

Completed Validation results are saved automatically. Reloading Validation restores the last viewed report, comparison, thresholds, reference labels and comparison reference from the shared Model builder workspace. Opening a large report shows **Restoring validation…** while its results load; it does not repeat training or full-population scoring.

After saving a model, open it in **Models** and select **Validation** to return to the report for that model version. Use **Saved validation** inside Validation to open another retained version. Each version keeps its saved thresholds. You can adjust thresholds on a restored report and select **Save model** to create a revision without retraining. To change comparison code, use **Train or edit in Learning** and validate the changed comparison.

Retained reports include the original selected field values and scores, so rebuilding the training table or changing source records does not alter their counts, examples or explanations. Uploaded reference labels and a comparison reference are retained with the report. Reports attached to saved model versions and the last viewed report remain available; other unlinked runs can expire after 24 hours. A report that expired before retention was available cannot be recovered.

Reports belong to the configured Model builder workspace. When using a separate PostgreSQL workspace with `MDMBOX_MODEL_BUILDER_JDBC_URL`, retain and back up that database as well as the database holding saved models.

#### Measure quality with reference labels

**Available from:** `edge`.

After a completed Validation run, load a JSON file under **Measured quality**. Use the IDs from the prepared population:

```json
{
  "mode": "reviewed",
  "pairs": [
    ["patient-a", "patient-b", true],
    ["patient-a", "patient-c", false]
  ]
}
```

`reviewed` evaluates only the supplied pairs. Use `complete` only when the reference mapping identifies every true matching pair in the prepared population: unlisted pairs are then treated as nonmatches, including model predictions. The file accepts up to 100,000 labeled pairs and 16 MB. Pair order does not matter; unknown IDs, self-pairs and conflicting labels are rejected.

The report shows precision, recall and F1 at both thresholds, plus true matches missed by blocking. A true labeled pair absent from the candidate set counts as a false negative. A metric with a zero denominator is undefined. These metrics use the same procedure for automatic, custom probabilistic and rule based models. Labels are used only for evaluation and are never passed to training. Threshold changes reuse the scores and recalculate metrics. Labels are restored with their report; a new population needs its own reference labels.

#### Compare changes

Comparison is optional. You can save the first version of a model after its completed Validation run. To examine a later change, select **Set reference**, edit and run the comparison in Learning, then return to Validation and select **Run again**.

**Changes since reference** groups all candidate pairs by their decisions before and after the change. Select a group and a pair to inspect its scores, record fields and comparison levels or custom metadata. Both variants use the thresholds captured with the reference, even if you change the current thresholds for the main Validation results or saving. Both runs must use the same prepared population and blocking rules; set a new reference after changing either. Review the pairs to judge whether the changed decisions are appropriate.

**Replace reference** makes the current completed run the new starting point; **Clear reference** returns to normal Validation. Changing the Learning sample or restarting its session preserves the reference because Validation uses the full population. Reloading a retained report restores its reference and captured thresholds. A new population or changed blocking rules require a new run and reference. Setting a reference does not save a model or create a version.

### Upgrade from the experimental engine

The experimental file workspace is no longer read. Models previously written for that engine require compatible PostgreSQL expressions. An execution-engine field does not translate their SQL or retrain weights. Execution options belong to matching requests; new model definitions must not contain `executionEngine` or `bulkQueryStrategy`.

### Shared model API

**Available from:** `edge`.

Shared scoring models are JSON definitions, separate from FHIR resources. Manage them with these authenticated endpoints:

| Request | Result |
| --- | --- |
| `GET /api/scoring-models` | List model IDs, types and current versions |
| `PUT /api/scoring-models/{id}` | Create or update a model; return its saved definition and `meta.versionId` |
| `GET /api/scoring-models/{id}` | Read the current definition |
| `GET /api/scoring-models/{id}?version=1` | Read an immutable revision |
| `DELETE /api/scoring-models/{id}` | Remove the model from new matching requests; retain revisions used by existing Bulk jobs |

Pause an active Continuous process before deleting its model. A model ID cannot reuse an existing `MatchingModel` or `BulkMatchingModel` ID. Shared models use probability or custom-score thresholds from 0 to 1; existing FHIR models retain their original weight thresholds. A rule-based score is defined by its author and is not necessarily a calibrated probability.

For example, this model compares exact given names among Patients sharing a family name:

```http
PUT /api/scoring-models/patient-exact
Content-Type: application/json
```

```json
{
  "id": "patient-exact",
  "resource": "Patient",
  "type": "rule-based",
  "variables": {
    "columns": [
      {"name": "family", "path": [{"name": "name", "list": true}, {"name": "family"}], "mode": "first"},
      {"name": "given", "path": [{"name": "name", "list": true}, {"name": "given", "list": true}], "mode": "first"}
    ],
    "variants": [],
    "transforms": []
  },
  "blocking": [["family"]],
  "compare": "(a, b) => a.given && b.given && a.given === b.given ? 0.9 : 0.1",
  "thresholds": {"certain": 0.95, "probable": 0.5}
}
```

Use `patient-exact` in all three matching modes. New online requests see committed records immediately; Learning's candidate cap does not apply to live matching. Bulk exports keep the existing pair shape and log2 `matchWeight`; for rule-based models it is derived from the score, with 0 and 1 bounded to finite weights.

Comparison functions receive `id` and the selected, transformed fields in all three modes. Field names use lower-case letters, digits and underscores, with a maximum of 63 characters; `id`, `seq`, `created_at` and `interval_no` are reserved. Model IDs use lower-case letters, digits and dashes, with a maximum of 63 characters. Importing a model applies the same custom-transformation expression checks as the Builder.

### Existing model compatibility

When a supported FHIR model is loaded for matching, MDMbox converts its feature conditions into JavaScript and saves an editable shared model with a stable `migrated-...` ID. Calls using the original model ID continue to work with the original weight thresholds and match grades. The original FHIR resource and APIs are preserved. Converted features retain SQL `NULL` and `ELSE` behavior; they do not acquire the Builder's zero-weight convention for missing fields. Field extraction and blocking continue to use PostgreSQL.

Automatic conversion supports comparisons, `AND`/`OR`/`NOT`, null checks, `IS DISTINCT FROM`, `IN`, `BETWEEN`, `LIKE`/`ILIKE`, concatenation, Levenshtein, Jaro–Winkler, substring, length, case conversion and null helpers. Unknown PostgreSQL functions, casts, arithmetic and subqueries in comparison conditions need manual conversion. Such models continue to run with their existing SQL behavior. To see a conversion error or open the converted definition, select **Convert to JavaScript** in Models, or call:

```http
POST https://<mdmbox-host>/api/scoring-models/$migrate
Content-Type: application/json

{"resourceType":"MatchingModel","id":"patient-model"}
```

Use `"BulkMatchingModel"` for a Bulk model. Success returns the shared definition and its new ID. HTTP 422 returns an OperationOutcome naming an unsupported expression; the original remains usable. Repeating a conversion retains the same revision when the definition has not changed. Saving changes through the original FHIR API refreshes the converted definition on its next use. Edits made directly to the shared model remain there while the FHIR source is unchanged; they are not copied back into the original FHIR resource.

Converted models declare `"score-scale":"weight"` and retain their old weight thresholds; Builder-created models use probabilities from 0 to 1. Keep that distinction when editing thresholds or supplying a `$match` threshold.

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
- In `block` entries, `column` refers to an extracted column; `sql` accepts a custom blocking expression
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
    { "name": "id", "type": "text", "source": "id" },
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
    { "name": "dob", "column": "dob" },
    { "name": "fn", "column": "family" }
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

### Choose a bulk query strategy

**Available from:** `edge`.

Set the optional `bulkQueryStrategy` property in a Bulk Start request to choose how the new job generates candidate pairs:

| Value | Behavior |
| --- | --- |
| `"or"` | Combine blocking rules in one join condition. This is the default when the property is omitted. |
| `"union"` | Generate candidate pairs separately for each block, remove duplicate pairs, then score them. |

For example, pass `{"bulkQueryStrategy":"union"}` to Bulk Start. Both strategies apply the same blocks, feature weights and thresholds. A model with one block uses a single join with either setting. This option applies to bulk jobs only; continuous matching does not use it.

Neither strategy is always faster. Candidate counts, overlap between blocks, indexes, batch size and data distribution affect the result. Compare completed jobs on the same prepared snapshot with the same `batchSize` and `workersCount` before choosing a strategy.

Changing only `bulkQueryStrategy` in a new Start request reuses prepared source data. Start uses the latest saved model; active jobs and Continue retain their original model version and strategy.

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
