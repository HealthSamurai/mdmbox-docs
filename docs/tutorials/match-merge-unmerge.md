---
description: Find a duplicate Patient, preview and execute a merge, then restore the records with unmerge.
---

# Match, merge, and unmerge records

This walkthrough uses two fictional Patients and an Encounter to show the full API workflow. You will find a duplicate, review a merge plan, move the Encounter to the surviving Patient, and reverse the merge.

Start the local environment from [Getting started](../getting-started.md). You need curl and jq. Run the commands in order in the same shell; `root:secret` is the API credential from the example Docker Compose configuration.

| Stage | `Patient/tutorial-source` | `Encounter/tutorial-encounter.subject.reference` |
| --- | --- | --- |
| Before merge and after preview | Exists | `Patient/tutorial-source` |
| After merge | Deleted | `Patient/tutorial-target` |
| After unmerge | Restored | `Patient/tutorial-source` |

`Patient/tutorial-target` remains the surviving record throughout the walkthrough.

## 1. Load the example records and model

Save these files in an empty working directory:

{% file src="/docs/mdmbox/assets/examples/tutorial-data.json?v=88b1a75fe9db61c8" %}
tutorial-data.json
{% endfile %}

{% file src="/docs/mdmbox/assets/examples/tutorial-model.json?v=b692af06d467ba23" %}
tutorial-model.json
{% endfile %}

The model uses canonical `mdm_` function names. If your installation only has [legacy names](../sql-functions.md#legacy-names), download this model instead and save it as `tutorial-model.json`:

{% file src="/docs/mdmbox/assets/examples/tutorial-model-legacy.json?v=d1828f42d1f756ac" %}
tutorial-model-legacy.json
{% endfile %}

Both Patients have the same name and birth date. The model compares given name, family name, and birth date, assigning a weight of 10 to each exact match. These weights demonstrate the workflow; [tune your model](../matching-models.md#tuning) for real data.

The name variables use [`mdm_unaccent_upper`](../sql-functions.md#normalization-helpers) to ignore accents and letter case.

Set the service URLs, load the FHIR records through Aidbox, and create the model through MDMbox:

```bash
export AIDBOX_URL=http://localhost:8888
export MDMBOX_URL=http://localhost:3000

curl --fail-with-body --user root:secret \
  --header 'Content-Type: application/fhir+json' \
  --data-binary @tutorial-data.json \
  "$AIDBOX_URL/fhir"

curl --fail-with-body --user root:secret \
  --header 'Content-Type: application/json' \
  --data-binary @tutorial-model.json \
  "$MDMBOX_URL/api/models"
```

**Expected:** a `transaction-response` Bundle from Aidbox and HTTP 201 with the created `MatchingModel` from MDMbox. The model ID is `tutorial-patient`, separate from the model installed by the welcome UI.

## 2. Find the duplicate

Match the stored source Patient:

```bash
curl --fail-with-body --user root:secret \
  --header 'Content-Type: application/fhir+json' \
  --data '{"resourceType":"Parameters","parameter":[{"name":"modelId","valueString":"tutorial-patient"}]}' \
  --output match-response.json \
  "$MDMBOX_URL"'/api/fhir/r4/Patient/tutorial-source/$match'

jq '.entry[] | select(.resource.id == "tutorial-target") |
  {id: .resource.id, details: .search.extension}' match-response.json
```

**Expected:** HTTP 200 with a `searchset` Bundle containing `tutorial-target`. Its match-grade extension is `certain`, and its match-weight extension is `30`. Other records in your database may also appear. Matching leaves both Patients and the Encounter unchanged.

## 3. Preview the merge

Use the built-in `simple` algorithm to merge the source into the target and move references in Encounters. Omitting `result` keeps the target's content unchanged.

```bash
cat > merge-preview.json <<'JSON'
{
  "resourceType": "Parameters",
  "parameter": [
    { "name": "source", "valueReference": { "reference": "Patient/tutorial-source" } },
    { "name": "target", "valueReference": { "reference": "Patient/tutorial-target" } },
    { "name": "merge-algorithm", "valueString": "simple" },
    { "name": "related-resource-type", "valueString": "Encounter" },
    { "name": "preview", "valueBoolean": true }
  ]
}
JSON

curl --fail-with-body --user root:secret \
  --header 'Content-Type: application/fhir+json' \
  --data-binary @merge-preview.json \
  --output merge-preview-response.json \
  "$MDMBOX_URL"'/api/fhir/$merge/v2'

jq '.parameter[] | select(.name == "outcome" or .name == "plan") |
  .resource' merge-preview-response.json
```

**Expected:** HTTP 200 with `outcome` and `plan` parameters. Review the OperationOutcome and transaction Bundle: the plan deletes `Patient/tutorial-source`, changes the Encounter's subject to `Patient/tutorial-target`, and includes audit records. Preview writes none of those changes.

Check that the Encounter still points to the source:

```bash
curl --fail-with-body --user root:secret \
  "$AIDBOX_URL/fhir/Encounter/tutorial-encounter" | jq -r '.subject.reference'
```

**Expected:** `Patient/tutorial-source`.

## 4. Execute and inspect the merge

Set `preview` to `false`, execute the request, and save the returned merge Task ID:

```bash
jq '(.parameter[] | select(.name == "preview") | .valueBoolean) = false' \
  merge-preview.json > merge-request.json

curl --fail-with-body --user root:secret \
  --header 'Content-Type: application/fhir+json' \
  --data-binary @merge-request.json \
  --output merge-response.json \
  "$MDMBOX_URL"'/api/fhir/$merge/v2'

MERGE_TASK_ID=$(jq -er '.parameter[] | select(.name == "task") | .resource.id' merge-response.json)
printf 'Merge Task: %s\n' "$MERGE_TASK_ID"

curl --fail-with-body --user root:secret \
  "$AIDBOX_URL/fhir/Encounter/tutorial-encounter" | jq -r '.subject.reference'

curl --silent --user root:secret --output source-after-merge.json \
  --write-out 'Source HTTP status: %{http_code}\n' \
  "$AIDBOX_URL/fhir/Patient/tutorial-source"
```

**Expected:** the merge returns HTTP 200 with an `outcome` and `task`. The Encounter now points to `Patient/tutorial-target`. Reading the deleted source returns HTTP 410. Keep the merge Task ID for unmerge.

Execution computes a plan against the current records; preview does not reserve their versions. See [Merge operation](../merge-operation.md#validation-and-conflicts) for conflicts and retry behavior.

## 5. Preview and execute unmerge

Pass the saved merge Task to `$unmerge/v2`. This example uses `restore` and makes no intervening edits. Restore can overwrite later edits, so review the outcome before executing; see [Unmerge algorithms](../unmerge-operation.md#algorithms) for the `strict` alternative.

```bash
jq -n --arg task "$MERGE_TASK_ID" '{
  resourceType: "Parameters",
  parameter: [
    {name: "task", valueReference: {reference: ("Task/" + $task)}},
    {name: "unmerge-algorithm", valueString: "restore"},
    {name: "preview", valueBoolean: true}
  ]
}' > unmerge-preview.json

curl --fail-with-body --user root:secret \
  --header 'Content-Type: application/fhir+json' \
  --data-binary @unmerge-preview.json \
  --output unmerge-preview-response.json \
  "$MDMBOX_URL"'/api/fhir/$unmerge/v2'

jq '.parameter[] | select(.name == "outcome" or .name == "plan") |
  .resource' unmerge-preview-response.json
```

**Expected:** HTTP 200 with the reversal plan and its outcome. The source is still deleted and the Encounter still points to the target until you execute:

```bash
jq '(.parameter[] | select(.name == "preview") | .valueBoolean) = false' \
  unmerge-preview.json > unmerge-request.json

curl --fail-with-body --user root:secret \
  --header 'Content-Type: application/fhir+json' \
  --data-binary @unmerge-request.json \
  --output unmerge-response.json \
  "$MDMBOX_URL"'/api/fhir/$unmerge/v2'
```

**Expected:** HTTP 200 with an outcome and a new unmerge Task. The original merge Task is marked `unmerged`. Unmerge depends on the merge's [audit records and FHIR history](../unmerge-operation.md#required-history); keep them while reversal is needed.

## 6. Check the restored records

```bash
curl --fail-with-body --user root:secret \
  "$AIDBOX_URL/fhir/Patient/tutorial-source" | jq '{resourceType, id, name, birthDate}'

curl --fail-with-body --user root:secret \
  "$AIDBOX_URL/fhir/Patient/tutorial-target" | jq '{resourceType, id, identifier}'

curl --fail-with-body --user root:secret \
  "$AIDBOX_URL/fhir/Encounter/tutorial-encounter" | jq -r '.subject.reference'
```

**Expected:** both Patients are readable again, and the Encounter points to `Patient/tutorial-source`. The target keeps its original identifier `person-001`.

Continue with [Matching models](../matching-models.md) to configure your comparisons, [Bulk matching](../bulk-match.md) to find pairs across a dataset, or [Algorithm management](../algorithms.md) to customize how duplicates are resolved.
