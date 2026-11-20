---
description: Create and configure matching models that define how MDMbox compares FHIR resources to find duplicates.
---

# Matching models

A matching model defines how MDMbox compares records to find duplicates. It specifies which fields to compare, how to compare them, and what scores to assign.

MDMbox supports shared scoring models and the existing FHIR model resources:

- **MatchingModel** — for online `$match` queries against individual resources
- **BulkMatchingModel** — shared by Bulk matching jobs and Continuous matching processes
- **Scoring model** — a model saved by Model builder, usable by `$match`, Bulk matching and Continuous matching with the same ID

`MatchingModel` and `BulkMatchingModel` are stored as FHIR resources. Their existing APIs and JSON formats remain supported. Shared scoring models use the [shared model API](#shared-model-api) and appear in the Models, Bulk matching and Continuous matching screens.

## Model builder preview

**Available from:** `2610.0`.

For an introduction to the feature and measured matching quality, see [Introducing Model builder in MDMbox](https://www.health-samurai.io/articles/mdmbox-model-builder).

In **Models → Model builder**, follow **Prepare data → Train model → Review & save**. In Prepare data, choose or create a Patient ViewDefinition and build the training table. In Train model, the **Model definition** editor contains one `model` definition: use automatic comparisons, add known alternatives, or define a deterministic model. Select **Build model** below the editor to prepare candidate pairs and fit probabilistic parameters or prepare the deterministic function. In Review & save, select **Run validation** to score the prepared population, inspect scores, choose thresholds and select **Save model**.

Ctrl+Enter (⌘+Enter on a Mac) runs **Build model**. After changing the definition or rebuilding the prepared data, build the model again and repeat validation before saving. **Templates** offers **Probabilistic**, which learns comparison weights, and **Deterministic**, which uses a scoring function you define. These are starting definitions that replace the editor document; use Undo to restore your changes. The model's `type` in JavaScript determines its behavior. Previous notebook drafts are retained as **Download previous draft** when moving to the model definition format.

Use the saved ID as `modelId` in a [$match request](match-operation.md) or select it in Bulk matching and Continuous matching. The model contains the selected fields, comparison definition, blocking rules and thresholds. Saving a changed definition creates an immutable version; saving the same definition again retains the version. Existing Bulk jobs and automatically resumed Continuous processes keep their original definition. An explicit Continuous Start or Resume uses the latest model and rebuilds when it changed.

If the table was rebuilt after the comparison was prepared, saving returns an error in Review & save. Train the model again and review the thresholds before saving.

Model builder and live matching use the saved JavaScript comparison definition. Online `$match` reads current committed resources; Bulk jobs use their own prepared snapshot, and Continuous matching keeps its comparison data current asynchronously. All three are independent of the Builder's training tables. The model definition editor provides `jaroWinkler`, `levenshtein` and `isPlaceholder` for JavaScript comparisons.

Building and saving a model prepare its candidate indexes for online matching. The first save or import can take longer on a large Patient population. Saving also checks the comparison against a small selection of current records before publishing the model. Patient writes remain available during index preparation. After a service restart, saved models are prepared before MDMbox accepts requests.

If an existing model needs new indexes, startup includes that preparation. In Helm deployments, increase `startupProbe.failureThreshold` when the configured startup budget is shorter than index preparation for your population. Models whose indexes are already present reuse them.

### SQL on FHIR projection

**Available from:** `2610.0`.

Prepare data uses a SQL on FHIR **ViewDefinition** to describe how Patient resources become matching columns. Use **Saved field mappings** to open a saved Patient definition, **New mapping** to start another, or **Edit JSON** to edit the complete definition. **Field mapping** sets its name. **Column definitions** edits column names, FHIRPath expressions and types. Choose a type ending in `[]`, such as `string[]`, to retain multiple values; this sets the standard `collection: true` property.

FHIRPath suggestions appear as you type directly in a column's expression and inside column `path` strings in JSON. For example, `na` offers Patient `name`, and `name.gi` offers HumanName `given`. The JSON editor also completes properties and types from the installed ViewDefinition schema. Use the arrow keys to select a suggestion, Enter or Tab to accept it, and Escape to close the list; Ctrl+Space remains available to request suggestions explicitly.

Column definitions and unfinished JSON edits are kept as a draft in this browser and restored after reload. Saving the ViewDefinition or preparing data publishes the current valid definition. Browser drafts are separate from saved FHIR resources.

Each column shows **Filled** and **Distinct** on the records selected by **Preview sample** as you edit its expression. Set the sample size from 1 to 100,000 records; the default is 1,000. Collections also show **Longest list**, the largest number of retained values in one sampled record. Open **Values** to see frequent values and the number of sample records containing each value. These statistics use the whole preview sample, independently of the record preview filter.

Select a value to open **Record preview** with its SQL condition, or use **Empty values** to find records missing a column. The preview shows the generated query with an editable **WHERE** condition. Select **Run** or press Ctrl+Enter (⌘+Enter on a Mac) to apply your changes. For example, `"email" IS NULL AND "gender" = 'female'` selects records with no email and a female gender value; `'Linda' = ANY("all_given")` finds a value in a collection. The result count refers to the preview sample. Open a record using its source button to inspect the original FHIR resource from that sample.

The WHERE editor supports column comparisons, `AND`, `OR`, `NOT`, `IS NULL`, `IN`, `BETWEEN`, `LIKE`, `ILIKE`, `ANY`, `ALL`, arithmetic and functions such as `lower`, `upper`, `trim`, `length`, `cardinality` and `coalesce`. It accepts a condition over projected columns; full SQL statements, subqueries, comments and arbitrary functions are rejected. Use `TRUE` to clear the filter. Preview conditions are not part of the ViewDefinition or model and never restrict the training population.

**Save mapping** stores the ViewDefinition as a FHIR resource. **Open in Aidbox** opens the same resource in the native editor; access there follows your Aidbox permissions. After editing there, select **Reload mapping** in the builder. **Prepare data** saves the definition and prepares matching columns for the full source population. If the source has not been prepared yet, select **Prepare source** first. **Refresh source** refreshes the source snapshot and starts a new preview sample.

The new Data step uses the ViewDefinition alone, without a separate cleanup or variant configuration. Selection and filters belong in FHIRPath. Automatic training normalizes case and whitespace. Use `name()` for spelling errors, `dictionary()` for known name variants, and a Boolean comparison for a domain rule. SQL on FHIR supports a subset of FHIRPath and does not support arbitrary string cleanup functions. A table created with the earlier transformation editor must be rebuilt before training with the new projection. Existing saved model versions keep their original transformations.

Matching requires one row per Patient, an `id` column with `getResourceKey()` or `id`, and at least one matching column. Use `collection: true` to keep multiple values in one column. Collection cleanup removes empty values and duplicates and stores values in a stable order. Scalar columns must select a single value; use `first()` when that is the intended choice. A Patient with missing selected values remains in the population with empty columns.

The matching projection supports column selections and nested `select` groups. Row filters (`ViewDefinition.where`), `forEach`, `forEachOrNull`, `unionAll`, `repeat` and runner-specific column extensions are rejected because they can change the population or require data unavailable to incoming-record matching. Column expressions support functions such as `where`, `first`, `join`, `ofType`, `exists` and the SQL on FHIR key functions. For example, `telecom.where(system = 'phone').first().value` selects the first phone value.

The saved model captures the ViewDefinition. Training, online `$match`, Bulk matching and Continuous matching use that captured projection. Editing the builder or the separate ViewDefinition later does not change a saved model version.

FHIRPath expressions use FHIR field names for extensions, choice fields and references. For example, `extension.where(url='https://example.org/patient-code').valueString`, `deceasedBoolean` and `managingOrganization.reference` select the same values during preparation and matching.

### Automatic training and JavaScript extensions

**Available from:** `2610.0`.

**Build model** selects candidate keys, builds their indexes and loads a reproducible sample. It starts with exact field keys. When fewer than three exact keys fit the candidate budget, it also considers normalized prefixes and suffixes, choosing combinations that retain simulated spelling errors and missing fields. Candidate costs are checked against the full prepared population. The same saved keys are used in validation and live matching. Probabilistic fitting requires at least three single-value source fields and candidate pairs. Deterministic models require at least one single-value source field and skip weight fitting. If no affordable candidate key is available, add useful source fields in Prepare data and build again.

**Per-field comparison profiles are available from:** `edge`.

The editor selects a comparison profile for each projected column. Review the choices before training. The model learns field-specific evidence for agreement, spelling differences and whole-field disagreement from the training population. When the sample shows dependencies, such as city and postal code, training accounts for their joint frequency.

**Learned comparisons** shows the selected comparisons and fitted parameters. Pair explanations in Review & save show contributions for the particular values being compared, including a joint normalization correction when Boolean comparisons are present. A Boolean coefficient is not a standalone match score. The resulting comparison is named `compare`.

List every selected source field in `comparisons`. Each field has a nonempty array of comparisons. For a population with given name, family name and city:

```javascript
const model = {
  resource: "Patient",
  type: "probabilistic",
  comparisons: {
    given: [name(), dictionary(["en", "es"])],
    family: [name()],
    city: [text()]
  }
}
```

Choose `name()` for personal names, `date()` for calendar dates, `identifier()` for codes, `category()` for categorical values, `address()` for address lines or `text()` for other strings. Name comparisons distinguish spelling changes from a completely different name. Date comparisons recognize equivalent dates, a day/month exchange, a one-day difference and partial date agreement. Missing values supply zero evidence.

`dictionary(["en", "es"])` adds known name variants. The model learns how often dictionary variants occur. A short form with several possible names distributes its probability among those alternatives. When training independent fields, a dictionary match contributes one weight for the name. The other fields keep their own comparison levels. Keep `name()` in the same array to allow spelling errors as well. Each field accepts one field profile, one `dictionary()` and Boolean functions, up to ten comparisons in total.

For example, a legacy export stores initials. Supplement the existing name comparisons with an initial rule, returning `null` when both names are complete:

```javascript
const model = {
  resource: "Patient",
  type: "probabilistic",
  comparisons: {
    given: [name(), dictionary(["en", "es"]), (a, b) => {
      const left = Array.from(a), right = Array.from(b);
      if (left.length !== 1 && right.length !== 1) {
        return null;
      }
      return left[0] === right[0];
    }],
    family: [name()],
    city: [text()]
  }
}
```

Custom functions receive two scalar strings after Unicode NFKC normalization, lowercasing, trimming and whitespace collapse. Return `true` for agreement, `false` for disagreement, or `null` when the rule does not apply. Missing values skip the function and supply no evidence. Functions must be deterministic and self-contained; put any extra helper inside the function. `levenshtein(a, b)` and `jaroWinkler(a, b)` are available. Return `levenshtein(a, b) < 2` to use a Boolean distance rule; raw numbers, strings, arrays and objects are not supported return values in this stage.

Adding a comparison supplements the other entries in its array. To replace spelling comparison with equality, use `identifier: [(a, b) => a === b]`. Only comparisons listed for the field are applied. A probabilistic agreement or disagreement is evidence, not a mandatory final decision. Use a deterministic model when the entire match decision must follow a fixed rule.

Dictionary comparisons accept up to 16 built-in or imported IDs, recognize compound names, and save the selected pairs inside the model. They reject names with more than 128 tokens or more than 4,096 generated alternatives. For FHIR given names, use `name.first().given.join(' ')` so `María José` can match `Majo`.

Training estimates parameters without reviewed labels. Candidate retrieval can still miss pairs that disagree on every selected key. A custom rule cannot recover a pair that was never retrieved. Rare rules may have insufficient examples to estimate their effect reliably. If training requests new population counts, prepare the data again; if it reports that no reference covers a comparison's availability, simplify or broaden when that comparison applies and rebuild. Review quality and thresholds before using a model.

**Changed in `edge`:** JavaScript models use the explicit comparison API and saved format 3. MDMbox skips unsupported definitions at startup and in the model catalogue. Looking up an unsupported revision through the model API returns HTTP 404. Bulk jobs and Continuous processes pinned to an unsupported definition are excluded from matching. For an earlier `edge` definition that used `typos()`, choose a profile for each field and rebuild the model. Saving a supported definition under the same ID creates a new revision. Notebook commands, comparison-level objects, `channels`, `alternatives`, `overrides` and `extensions` are no longer supported. `MatchingModel` and `BulkMatchingModel` retain their SQL APIs and formats.

Administrators with PostgreSQL access can recover the original JSON of any saved revision. Substitute the model ID below.

```sql
SELECT version, model
FROM mdm.scoring_model_history
WHERE id = 'my-model'
ORDER BY version;
```

See [Custom comparison examples](custom-comparison-examples.md) for complete models covering initials, swapped dates, local dictionaries, exact identifiers and Boolean-only training. Each example starts with the user case and describes what to check after building.

For a deterministic model, define a complete decision function:

```javascript
const model = {
  resource: "Patient",
  type: "deterministic",
  compare: (a, b) => ({
    score: a.phone && a.phone === b.phone ? 1 : 0,
    meta: { reason: "phone agreement" }
  })
}
```

Return score `1` for a match and `0` otherwise, optionally with explanatory `meta`. The function must be self-contained. **Build model** prepares it without estimating weights. Both model types use automatically selected candidate keys, so evaluate their coverage as well as their decisions in Review & save.

#### Training iteration limit

**Available from:** `edge`

In **Train model → Training options**, set **Maximum iterations** to a whole number from 1 to 100,000. Training stops earlier when it converges. Leave the field empty for the default of 100 iterations. If the limit is reached first, the builder shows that training has not converged; the latest fitted model remains available for review. Deterministic models do not use this setting.

The setting is remembered when you reload or return in the same browser tab. Changing it requires **Build model** again before validating the new build. The saved model's `training.maxIterations` records the effective limit. A larger limit gives training more time to converge; it does not guarantee better matching accuracy.

### AI assistant

Configure [OpenAI or Anthropic](config-reference.md#ai-assistant) on the server, select a provider beside the model definition editor, and ask for a comparison, an explanation or a code review. If configuration is incomplete, **Missing environment variables** lists only the unset variables for the selected provider. The assistant receives your messages, editor code, field names, blocking rules and aggregate sample counts. Sample Patient records are excluded. Values you type into a message or include in code are sent as part of that text.

Hide the assistant to expand the editor, then reopen it with **AI assistant** beside **Templates**. Hiding it preserves the conversation and unsent message. The navigation control in the bottom-left corner offers **Expanded**, **Collapsed** and **Expand on hover** modes. Both layout preferences are saved in your browser.

Review suggested code before inserting it or replacing the editor. Replacement is blocked if you have edited the code since asking; request an updated suggestion. Select Build model and inspect Review & save before saving a model. Chat proposals do not run or publish automatically. **New chat** keeps previous conversations in **History**. Conversations, provider selection and unsent messages are saved in this browser and restored after reload; they are not shared with other browsers. Clearing browser data removes this history.

### Training data

**Prepare source** captures current Patient records. Set **Preview sample** to the number of records used for column statistics and record preview, from 1 to 100,000; the default is 1,000. Changing it refreshes both views and is remembered in this browser. The sample is capped by the available source records and does not control the training sample. **Prepare data** projects the full captured population into the training table, regardless of preview filters or preview sample size. Source changes after preparation do not update that table; select **Refresh source** and prepare data again to use newer records. You can reopen Model builder to follow a running preparation job on the same MDMbox instance.

Build model loads a reproducible training sample automatically. Large equality groups are sampled as pairs, so a common name or address does not truncate the training data or prevent an otherwise affordable key from being used. Fitting can use additional keys to estimate each field independently; the saved model retains only the keys selected for candidate retrieval. Conditional frequency models count the full prepared population and use separate source folds to estimate accidental agreement. Run validation checks all candidate pairs under the saved keys across the prepared table without the training sample limit.

During preparation, Model builder shows the current stage and elapsed time. Steps with measurable counters show completed work and a percentage; other steps show activity without a percentage or remaining-time estimate. A completed stage does not mean the entire preparation has finished.

Prepared profiles and tables survive normal MDMbox restarts. If PostgreSQL crash recovery clears the rebuildable training data, profile and build again; saved ViewDefinitions and model versions remain available. Use one MDMbox instance for Model builder jobs when replicas share a database; running jobs and their status belong to the instance that started them.

By default, the builder uses MDMbox's configured database. To use another PostgreSQL source and training workspace, set [`MDMBOX_MODEL_BUILDER_JDBC_URL`](config-reference.md#model-builder). Saved models and live matching use MDMbox's configured database.

### Interpreting Validation

Select **Run validation** to score every distinct candidate pair under the blocking rules across the full prepared table. Progress shows processed records and scored pairs. **Pause** replaces the start action while validation is running. It pauses processing after the current portion and changes to **Continue validation**. Switching to another step also pauses processing. Reloading Review & save automatically continues a run that was active before reload; a manually paused run stays paused. After leaving the page or restarting the application, reopen Review & save to continue an active run from its stored progress. Continuing uses the original comparison and scores each candidate pair once. A changed prepared population or a newly built model needs a new validation run. The first run can take longer while comparison code is initialized; total time depends on candidate volume and comparison cost.

During processing, **Results so far** updates the score distribution, decision counts and examples from pairs already scored. You can adjust the review and same-person thresholds or inspect feature combinations and record pairs while the check continues. Records are processed in ID order, so early results are not a random sample or a projection of the final population. Save the model after validation completes.

Completed results show exact record and candidate counts, the score distribution, and paginated pairs with field values and comparison explanations. Select a chart point to see the feature-level combinations among the pairs on that page, then select a combination to inspect its pairs. Page through the selected score range to inspect more pairs; combination counts refer only to the visible page. The selected interval is shaded and its points are highlighted. Drag the shaded area to move it, or change **From** and **To** or drag the handles beneath its edges to adjust its width. This inspection interval does not change the model's thresholds. Probabilistic models show interval bounds in points; rule based models show score bounds. Changing thresholds or interval bounds reuses the computed scores. The chart groups probability scores in steps of 0.005, or probabilistic model weights in steps of 0.1; weights outside −100 to +100 share the end bins. Decision counts use the original scores, without chart rounding.

These counts describe model decisions. They are not measured precision or recall: determining errors requires independently reviewed reference pairs, including a search for matches excluded by blocking. A run covers the prepared population, not source edits made after **Prepare data**. After changing comparison code, its sample or the matching rules, run validation again before saving the changed comparison.

#### Reopen Validation

**Available from:** `2610.0`.

Completed Validation results are saved automatically. Reloading Validation restores the last viewed report, comparison and thresholds from the shared Model builder workspace. The summary, score distribution and candidate pairs appear independently as they load. If one section fails, use its **Retry** action; the other results remain available. Reopening a report does not repeat training or full-population scoring.

After saving a model, open it in **Models** and select **Validation** to return to that version. The link opens its retained report first. If a report has not been saved and the workspace has a paused validation with the same scoring definition, candidate rules and prepared population, the page shows its partial results at the selected version’s thresholds. Select **Continue validation** to resume from the last processed pair, then **Save model** to retain the finished report.

In Review & save, select **Saved validation**, search by model ID and open the required version. Each version keeps its saved thresholds. You can adjust thresholds on a restored report and select **Save model** to create a revision without retraining. To change comparison code, use **Edit matching logic** and validate the changed comparison. A **Comparison function** selector appears only when the current build contains several comparison functions.

Retained reports include the original selected field values and scores, so rebuilding the training table or changing source records does not alter their counts, examples or explanations. Reports attached to saved model versions and the last viewed report remain available; other unlinked runs can expire after 24 hours. Select **Delete report** beside a version in **Saved validation** to remove its retained results. Confirm the deletion in the list. The saved model and its revisions remain runnable. Scores and record snapshots are removed when no other report uses them. Deleted reports cannot be restored. A report that expired before retention was available cannot be recovered.

Reports belong to the configured Model builder workspace. When using a separate PostgreSQL workspace with `MDMBOX_MODEL_BUILDER_JDBC_URL`, retain and back up that database as well as the database holding saved models.

### Upgrade from the experimental engine

The experimental file workspace is no longer read. Models previously written for that engine require compatible PostgreSQL expressions. An execution-engine field does not translate their SQL or retrain weights. Execution options belong to matching requests; new model definitions must not contain `executionEngine` or `bulkQueryStrategy`.

### Shared model API

**Available from:** `2610.0`.

Shared scoring models are JSON definitions, separate from FHIR resources. Manage them with these authenticated endpoints:

| Request | Result |
| --- | --- |
| `GET /api/scoring-models` | List model IDs, types and current versions |
| `PUT /api/scoring-models/{id}` | Create or update a model; return its saved definition and `meta.versionId` |
| `GET /api/scoring-models/{id}` | Read the current definition |
| `GET /api/scoring-models/{id}?version=1` | Read an immutable revision |
| `DELETE /api/scoring-models/{id}` | Remove the model from new matching requests; retain revisions used by existing Bulk jobs |

Pause an active Continuous process before deleting its model. A model ID cannot reuse an existing `MatchingModel` or `BulkMatchingModel` ID. Shared models use thresholds from 0 to 1; FHIR models retain their original weight thresholds. Probabilistic models return a learned probability. Deterministic models return a decision score of 0 or 1.

**Available from:** `edge`

Open a saved JavaScript model in **Models** to edit a revision. The JavaScript definition shows the target FHIR resource, for example `resource: "Patient"`. Each revision uses the resource type of its projection. For a probabilistic model, edit the comparison definition and select **Retrain and review**. Review the candidate count and changes in match grades at the saved thresholds before selecting **Save revision**. Retraining uses the original prepared table version and blocking rules. If the workspace has changed, use Model Builder to prepare the intended population and train there. The JavaScript definition includes `thresholds`, for example `thresholds: { certain: 0.95, probable: 0.5 }`. Use numeric values from 0 to 1 with `probable` at or below `certain`. Edit just these values and select **Save revision** to keep the fitted weights. Model Builder also accepts `thresholds` in the training definition and uses them as the starting values in **Review & save**.

For a deterministic model, edit the comparison expression and select **Test pair** with two JSON records using the projected column names. Review the returned score or decision, then select **Save revision**. An edited imported comparison is labeled **Customized HAPI rules**. Use **Export revision** to download the complete saved model JSON and any required custom dictionary CSVs. API clients can send a quoted revision number in the `If-Match` header on `PUT /api/scoring-models/{id}`. A stale revision returns HTTP 412.

Export and import the complete saved definition with `format-version: 3`. Probabilistic exports store either per-field outcome weights (`field-levels-v1`) or the fitted comparison model (`comparisons-v1`), including its dictionary references and population frequencies. Deterministic models store the source of `compare`. Both types include the projection, candidate keys and thresholds and work with online, Bulk and Continuous matching. Keep the exported likelihood intact; editing its fitted parameters or reference data changes the model. Raw population values used during training are not included in the exported likelihood. Models can be larger than 8 MiB; see [HTTP request size](config-reference.md#http-request-size).

For example, this model compares exact given names among Patients sharing a family name:

```http
PUT /api/scoring-models/patient-exact
Content-Type: application/json
```

```json
{
  "id": "patient-exact",
  "resource": "Patient",
  "format-version": 3,
  "type": "deterministic",
  "variables": {
    "viewDefinition": {
      "resourceType": "ViewDefinition",
      "name": "patient_matching",
      "status": "active",
      "resource": "Patient",
      "select": [{"column": [
        {"name": "id", "path": "getResourceKey()", "type": "id"},
        {"name": "family", "path": "name.first().family.first()", "type": "string"},
        {"name": "given", "path": "name.first().given.first()", "type": "string"}
      ]}]
    },
    "columns": [
      {"name": "family"},
      {"name": "given"}
    ],
    "variants": [],
    "transforms": []
  },
  "blocking": [["family"]],
  "compare": "(a, b) => a.given && b.given && a.given === b.given ? 1 : 0",
  "thresholds": {"certain": 0.95, "probable": 0.5}
}
```

Use `patient-exact` in all three matching modes. New online requests see committed records immediately; the training candidate cap does not apply to live matching. Bulk exports keep the existing pair shape and log2 `matchWeight`; deterministic decisions 0 and 1 are bounded to finite weights.

### Import HAPI FHIR MDM rules

**Available from:** `edge`

In **Models → New Model**, open **Import rules** and select the source HAPI FHIR release. Drop the MDM rules JSON file into the import area or select **browse** to choose it. Select the resource type for a file with several `mdmTypes`. Enable nickname search expansion if the source deployment registered the HAPI nickname search interceptor. Review the generated model ID and comparison, then select **Save**.

Select **8.6.0** or **9.0.0** to match the source HAPI FHIR release. Both use FHIR R4. Version 9.0.0 also supports multiple EID systems for a resource type. The `version` in a rules file identifies the author's rule revision. To convert through the API, send `POST /api/scoring-models/import-hapi` with `id`, `resource`, `hapiVersion`, and the parsed rules object in `rules`. The optional boolean `nicknameSearch` defaults to `false`. Set `candidateSearchLimit` if the source uses a different per-group online search limit. The HAPI default is 10,000. Reaching the limit returns an OperationOutcome. Save the returned definition with `PUT /api/scoring-models/{id}`.

A deterministic comparison may return `{decision: "MATCH"}`, `{decision: "POSSIBLE_MATCH"}`, or `{decision: "NO_MATCH"}`. The corresponding MDMbox decision scores are 1, 0.5, and 0. An imported comparison also returns the sum of scores of the fields that matched in `hapiScore`. Online matching orders HAPI results by that sum divided by the number of applicable fields. The FHIR Bundle carries this normalized value in `entry.search.score`. Its match grades are `certain` and `possible`. With a configured EID system, an online EID hit returns the matching resource with score 1 and takes precedence over ordinary rules. Checking a record is read-only. Merge or update records through an explicit MDMbox operation.

On the saved revision, select **Validate current records** to score a separate snapshot of the current resources. The resulting Model Builder report is attached to that model revision. Selecting the action again refreshes its report. Bulk, Continuous and validation evaluate the eligible search directions for each unordered pair. In Bulk and Continuous, a pair is retained when either direction qualifies. Its stored details report the decision and original HAPI score for each eligible direction.

Candidate groups are alternatives. Every term in a group must hold. A column name means equality. Use `{"column":"aliases","operator":"overlaps"}` for a shared value between two text arrays, `prefix` for a candidate array value starting with an input array value, and `date` for an R4 birth date within the input date's precision. An optional `inputColumn` supplies a separately projected input value. Use `"blocking":"all"` to score the entire eligible population. Put fixed candidate-side constraints in `candidateFilter`, for example `[{"column":"active","value":true}]`.

The importer accepts the standard search parameters used in the example models for identifiers, birth dates, names, phone numbers, general practitioners and manufacturers. String search on given or family name supports `:exact`. Candidate groups also support `active` and `gender`. Fixed filters on these parameters accept equality and the HAPI `NOT` qualifier. A negative filter includes records with a missing value. Match fields can navigate elements, select a position, use `first()`, `last()`, `ofType()`, combine paths with `|` and filter on a simple equality. Unsupported syntax produces an import error. An external Smile CDR deployment can supply different search parameters, interceptors or matcher implementations.

Case-insensitive name searches use the PostgreSQL ICU collation `und-x-icu` for Unicode uppercase conversion. A general-practitioner or manufacturer search uses the logical target ID and resource type, including when the input refers to a specific version. When comparing deployments, use the same source population and account for explicit MDMbox pair exclusions. The importer targets HAPI's default handling of placeholder records.

You can also use the versioned comparison functions directly in deterministic JavaScript. Both supported HAPI releases use the same built-in algorithms here. `hapi860.matches(options, left, right)` returns a boolean for a pair of R4 values. `hapi860.similarity(options, left, right)` returns the numeric similarity for a pair of primitives. Apply your chosen threshold to that number.

```js
hapi860.matches({algorithm: "NICKNAME"}, "Elizabeth", "Beth")
hapi860.matches({algorithm: "IDENTIFIER", identifierSystem: "urn:hospital:mrn"},
  {system: "urn:hospital:mrn", value: "123"}, {system: "urn:hospital:mrn", value: "123"})
hapi860.similarity({algorithm: "JARO_WINKLER"}, "Martha", "Marhta")
```

The built-in matchers are `STRING`, `SUBSTRING`, `NUMERIC`, `DATE`, `EMPTY_FIELD`, `IDENTIFIER`, `EXTENSION_ANY_ORDER`, `NICKNAME`, `NAME_FIRST_AND_LAST`, `NAME_ANY_ORDER`, `CAVERPHONE1`, `CAVERPHONE2`, `COLOGNE`, `DOUBLE_METAPHONE`, `MATCH_RATING_APPROACH`, `METAPHONE`, `NYSIIS`, `REFINED_SOUNDEX` and `SOUNDEX`. Similarities are `JARO_WINKLER`, `COSINE`, `JACCARD`, `LEVENSCHTEIN` and `SORENSEN_DICE`, each also available with the `NUMERIC_` prefix.

Use `resourcePath` for dot-separated R4 element names and `fhirPath` when you need a positional selection or a filter. An imported `EXTENSION_ANY_ORDER` or `EMPTY_FIELD` rule on a primitive also reads the corresponding underscore-prefixed element, including its position in a repeated field.

### Compare given names using dictionaries

**Available from:** `edge`

Use `compareGivenWithDictionaries(left, right, options)` inside a deterministic JavaScript comparison. For automatic training, use `dictionary()` in the field's comparison list. Both arguments are flat arrays of strings, such as the original FHIR `HumanName.given` arrays. The helper compares the whole sequence in order, ignoring case and spacing while preserving accents. A dictionary entry can relate multiple adjacent words to a single variant. Two variants of the same full name also match each other. For example, entries linking Elizabeth to Beth and Bessie allow Beth to match Bessie. Missing or empty values return `false`.

The helper runs after candidate selection. A pair must satisfy a configured blocking rule to reach the comparison.

```js
compareGivenWithDictionaries(["María", "José", "Elena"], ["Majo", "Elena"], {
  dictionaries: ["es"],
  details: true
})
// { matches: true, links: [
//   { name: "María José", variant: "Majo", dictionaries: ["es"], isAmbiguous: false }
// ] }
```

The helper returns a boolean by default. Set `details: true` to get `matches` and the dictionary links used for a match. Exact matches have an empty `links` array. A link is ambiguous when its variant points to more than one full name across the selected dictionaries. For example, `Manu` can stand for `Manuel` or `Manuela`. A full name can have several distinct variants without making those links ambiguous. Use the result to accept only unambiguous links in a deterministic rule or explain the decision in `meta`.

The default selection includes `en` and `es`. Pass `dictionaries` to choose the IDs for a comparison. English coverage comes from a [US name-variant dataset](https://github.com/carltonnorthern/nicknames). Spanish coverage comes from the [Wiktionary list of Spanish diminutives](https://en.wiktionary.org/w/index.php?oldid=92654536).

#### Import a custom dictionary

In the Admin UI, open **Models → Name dictionaries** to browse built-in and imported dictionaries. Filter the dictionary list by ID or language, select a dictionary, and search its full names and variants. Search ignores case and accents. Use **Copy ID** to reference the selected dictionary in a model.

Expand **Import a dictionary** to download an example CSV or upload your own. Enter a new dictionary ID and upload a UTF-8 CSV with the header `name,variant`. Each row maps a full name to a variant. Use spaces between words in a compound name. For example, `María José,Majo`. A file can contain up to 10,000 data rows and 1,000,000 characters. IDs contain up to 63 lowercase letters, digits, and dashes and start with a letter or digit. The IDs `en` and `es` are reserved.

For automatic training, pass up to 16 IDs to `dictionary(["en", "clinic-aliases"])` in the field's `comparisons` array. For deterministic or hand-authored comparison functions, declare imported IDs in the model's `nameDictionaries` array and select those IDs in the comparison call.

In Model Builder, create a scalar `given` column with the FHIRPath `name.first().given.join(' ')` to preserve the order of a compound given name. Collection columns sort and deduplicate their values. Wrap each joined string in a one-element array when calling the helper.

Joined given-name columns can also participate in blocking rules. Model Builder and model saving create the corresponding indexes for online matching.

In **Train model → Templates → Name dictionaries**, start from an explicit model with a profile for each selected source field and `dictionary(["en", "es"])` added to `given`. **Browse dictionaries** opens a new tab so you can look up IDs while training runs. The **Name dictionaries** sidebar link opens the catalog in the current tab. Model Builder restores the selected step and definition draft when you return in the same browser tab.

```js
const model = {
  resource: "Patient",
  type: "deterministic",
  nameDictionaries: ["clinic-v1"],
  compare: (a, b) => compareGivenWithDictionaries([a.given], [b.given], {
    dictionaries: ["es", "clinic-v1"]
  }) ? 1 : 0
}
```

For a hand-authored model with SQL column expressions, use a `jsonb` column with `(#.resource #> '{name,0,given}')` to pass the original array directly.

Imported dictionaries are immutable. Import a new ID to revise the pairs, then rebuild the model. New probabilistic models store each selected dictionary ID and its content fingerprint. When moving a model, open **Export revision**, download its JSON and any custom dictionary CSVs, then import those CSVs under the same IDs on the destination. The comparison lists the IDs in `dictionaries` and the corresponding fingerprints in `hashes`. MDMbox checks each fingerprint when loading the model. Reordering CSV rows or repeating a pair preserves its fingerprint. Reversing the name and variant columns can change it. Earlier format 3 revisions with embedded pairs continue to use their saved contents. Models that call `compareGivenWithDictionaries` directly require the same CSV under the same ID before saving on the destination.

Comparison functions receive `id` and the projected fields in all three modes. Field names use lower-case letters, digits and underscores, with a maximum of 63 characters; `id`, `seq`, `created_at` and `interval_no` are reserved. Model IDs use lower-case letters, digits and dashes, with a maximum of 63 characters. Imported legacy transformations retain their expression validation.

With `variables.viewDefinition`, `variables.columns` lists the matching columns in the same order, excluding `id`. Extraction paths belong in the ViewDefinition. The API retains optional `clean-steps`, `min-length`, variants and transformations for compatibility with earlier saved definitions; the new Data editor does not add them. Definitions using the earlier `variables.columns[].path` or `expression` format also remain supported.

### Benchmark model definitions

Download the definitions measured on public FEBRL, ePBRN and NC Voters datasets. Each archive includes models at the automatic and validation-selected thresholds, exact result metadata, input hashes and code hashes. No source Patient records or pair-level evaluation data are included.

FEBRL and ePBRN projections expect the benchmark's source-value Patient extensions. NC Voters models read Patient name and address fields. The learned parameters, population frequencies and thresholds belong to those datasets. Build and validate a new model for your own population rather than adopting a benchmark threshold without assessment.

The [feature overview and benchmark report](https://www.health-samurai.io/articles/mdmbox-model-builder#matching-quality-without-labeled-training-pairs) explains the datasets, evaluation protocol, precision, recall and F1.

{% file src="/docs/mdmbox/assets/benchmarks/nc-voters-20261105.zip?v=16337bdaeec52a43" %}
Download NC Voters retrieval results and models
{% endfile %}

{% file src="/docs/mdmbox/assets/benchmarks/febrl-20261105.zip?v=15beb3abbb392726" %}
Download FEBRL benchmark results and models
{% endfile %}

{% file src="/docs/mdmbox/assets/benchmarks/epbrn-20261105.zip?v=6deb8f5832c30b86" %}
Download ePBRN benchmark results and models
{% endfile %}

### Benchmark datasets

Download the FHIR Patient data separately from the model/result archives above. Each dataset has three files: gzip-compressed Patient NDJSON, its ViewDefinition, and gzip-compressed ground-truth CSV.

| Dataset | Patient records | Data | Field mapping | Labels |
| --- | ---: | --- | --- | --- |
| FEBRL1 | 1,000 | [Patient NDJSON](https://storage.googleapis.com/aidbox-public/mdmbox/benchmarks/20261106/febrl1/patients.ndjson.gz) | [ViewDefinition](https://storage.googleapis.com/aidbox-public/mdmbox/benchmarks/20261106/febrl1/viewdefinition.json) | [Ground truth](https://storage.googleapis.com/aidbox-public/mdmbox/benchmarks/20261106/febrl1/ground-truth.csv.gz) |
| FEBRL2 | 5,000 | [Patient NDJSON](https://storage.googleapis.com/aidbox-public/mdmbox/benchmarks/20261106/febrl2/patients.ndjson.gz) | [ViewDefinition](https://storage.googleapis.com/aidbox-public/mdmbox/benchmarks/20261106/febrl2/viewdefinition.json) | [Ground truth](https://storage.googleapis.com/aidbox-public/mdmbox/benchmarks/20261106/febrl2/ground-truth.csv.gz) |
| FEBRL3 | 5,000 | [Patient NDJSON](https://storage.googleapis.com/aidbox-public/mdmbox/benchmarks/20261106/febrl3/patients.ndjson.gz) | [ViewDefinition](https://storage.googleapis.com/aidbox-public/mdmbox/benchmarks/20261106/febrl3/viewdefinition.json) | [Ground truth](https://storage.googleapis.com/aidbox-public/mdmbox/benchmarks/20261106/febrl3/ground-truth.csv.gz) |
| FEBRL4 | 10,000 | [Patient NDJSON](https://storage.googleapis.com/aidbox-public/mdmbox/benchmarks/20261106/febrl4/patients.ndjson.gz) | [ViewDefinition](https://storage.googleapis.com/aidbox-public/mdmbox/benchmarks/20261106/febrl4/viewdefinition.json) | [Ground truth](https://storage.googleapis.com/aidbox-public/mdmbox/benchmarks/20261106/febrl4/ground-truth.csv.gz) |
| ePBRN D | 11,717 | [Patient NDJSON](https://storage.googleapis.com/aidbox-public/mdmbox/benchmarks/20261106/epbrn-d/patients.ndjson.gz) | [ViewDefinition](https://storage.googleapis.com/aidbox-public/mdmbox/benchmarks/20261106/epbrn-d/viewdefinition.json) | [Ground truth](https://storage.googleapis.com/aidbox-public/mdmbox/benchmarks/20261106/epbrn-d/ground-truth.csv.gz) |
| ePBRN F | 14,067 | [Patient NDJSON](https://storage.googleapis.com/aidbox-public/mdmbox/benchmarks/20261106/epbrn-f/patients.ndjson.gz) | [ViewDefinition](https://storage.googleapis.com/aidbox-public/mdmbox/benchmarks/20261106/epbrn-f/viewdefinition.json) | [Ground truth](https://storage.googleapis.com/aidbox-public/mdmbox/benchmarks/20261106/epbrn-f/ground-truth.csv.gz) |
| NC Voters 5M | 5,000,000 | [Patient NDJSON](https://storage.googleapis.com/aidbox-public/mdmbox/benchmarks/20261106/nc-voters-5m/patients.ndjson.gz) | [ViewDefinition](https://storage.googleapis.com/aidbox-public/mdmbox/benchmarks/20261106/nc-voters-5m/viewdefinition.json) | [Ground truth](https://storage.googleapis.com/aidbox-public/mdmbox/benchmarks/20261106/nc-voters-5m/ground-truth.csv.gz) |
| NC Voters 10M | 10,000,000 | [Patient NDJSON](https://storage.googleapis.com/aidbox-public/mdmbox/benchmarks/20261106/nc-voters-10m/patients.ndjson.gz) | [ViewDefinition](https://storage.googleapis.com/aidbox-public/mdmbox/benchmarks/20261106/nc-voters-10m/viewdefinition.json) | [Ground truth](https://storage.googleapis.com/aidbox-public/mdmbox/benchmarks/20261106/nc-voters-10m/ground-truth.csv.gz) |

The ground-truth CSV has the header `record_id,entity_id`. `record_id` equals `Patient.id`; equal `entity_id` values identify records belonging to the same person within that dataset. Every record is included, including singletons. Read both identifiers as strings. These column names describe these downloads; they are not a standard upload format, and MDMbox has no ground-truth upload endpoint. Labels are separate from the Patient matching fields and were not used for automatic training.

FEBRL and ePBRN retain intentionally corrupted source values in Patient string extensions. Their supplied ViewDefinitions read those extensions. NC Voters uses Patient name and address elements. Health Samurai converted the source records to FHIR and replaced record identifiers with opaque IDs; the selected source values and identity membership are preserved. FEBRL downloads exclude social security identifiers, and ePBRN includes records with a reference identity. Use the supplied mapping to reproduce the measured inputs.

**Sources and attribution:** FEBRL synthetic datasets were generated with [Febrl, by Peter Christen and Tim Churches](https://users.cecs.anu.edu.au/~Peter.Christen/Febrl/febrl-0.3/febrldoc-0.3/node70.html), distributed through the [Python Record Linkage Toolkit](https://github.com/J535D165/recordlinkage) ([upstream license and notices](https://github.com/J535D165/recordlinkage/blob/master/LICENSE)). The synthetic, error-simulated ePBRN D/F datasets come from [Vo, Jonnagaddala and Liaw's repository](https://github.com/ePBRN/Medical-Record-Linkage-Ensemble) and their [2019 paper](https://doi.org/10.1016/j.jbi.2019.103220). NC Voters is provided by [Prof. Erhard Rahm's database group at Leipzig University](https://dbs.uni-leipzig.de/research/projects/benchmark-datasets-for-entity-resolution) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); cite Saeedi, Peukert and Rahm, [Comparative Evaluation of Distributed Clustering Schemes for Multi-source Entity Resolution, ADBIS 2017](https://dbs.uni-leipzig.de/research/publications/comparative-evaluation-of-distributed-clustering-schemes-for-multi-source). NC contains voter-derived values and generated duplicates, not clinical records. Original attribution and source terms continue to apply to the converted data.

Download the [file checksums](https://storage.googleapis.com/aidbox-public/mdmbox/benchmarks/20261106/checksums.sha256) to verify the compressed files before importing them.


### Existing model compatibility

Existing `MatchingModel` and `BulkMatchingModel` resources keep their SQL definitions, original IDs, weight thresholds and FHIR APIs. Reading or running them does not convert them to JavaScript or create shared model revisions. New models created in Model builder use the shared JavaScript model format.

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

**Available from:** `2610.0`.

Set the optional `bulkQueryStrategy` property in a Bulk Start request to choose how the new job generates candidate pairs:

| Value | Behavior |
| --- | --- |
| `"or"` | Combine blocking rules in one join condition. This is the default when the property is omitted. |
| `"union"` | Generate candidate pairs separately for each block, remove duplicate pairs, then score them. |

For example, pass `{"bulkQueryStrategy":"union"}` to Bulk Start. Both strategies apply the same blocks, feature weights and thresholds. A model with one block uses a single join with either setting. This option applies to bulk jobs only; continuous matching does not use it.

Neither strategy is always faster. Candidate counts, overlap between blocks, indexes, batch size and data distribution affect the result. Compare completed jobs on the same prepared snapshot with the same `batchSize` and `workersCount` before choosing a strategy.

Changing only `bulkQueryStrategy` in a new Start request reuses prepared source data. Start uses the latest saved model; active jobs and Continue retain their original model version and strategy.

## Admin UI

In the Admin UI at `/mdmbox/admin` on the Aidbox address, select a model in **Models** to edit its JSON, or choose **New Model** to create one. The list marks `MatchingModel` as **Online only** and `BulkMatchingModel` as **Bulk & Continuous only**. Scoring models work in all three modes and have no mode badge. Check the resource type before saving or deleting because the two FHIR model types can share an ID.

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
