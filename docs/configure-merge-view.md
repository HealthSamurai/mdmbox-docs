# Configure Merge View

By default, the merge UI displays a fixed set of patient fields (ID, name, gender, birth date). The **MergeViewModel** feature lets you customize which fields appear in the merge view — and in what order — without changing any code.

A MergeViewModel is a database record containing an ordered list of field descriptors. Each field has a human-readable **label** and a **JSONPath expression** that tells the system how to read and write values from FHIR Patient resources.

## How it works

1. You create a `MergeViewModel` record in the database with the desired field configuration.
2. You set the `MERGE_VIEW_MODEL_ID` environment variable to the record's ID.
3. When a clinician opens the merge UI, the system loads the configured fields and renders them instead of the defaults.

If the environment variable is not set or the record is not found, the system falls back to the default field list automatically.

## Environment variable

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MERGE_VIEW_MODEL_ID` | No | — | ID of the MergeViewModel record to use. If unset, the default fields are shown. |

## Create a MergeViewModel

Insert a record directly into the database:

```sql
INSERT INTO mpi.mergeviewmodel (id, version, resource)
VALUES (
  'my-merge-view',
  1,
  '{
    "id": "my-merge-view",
    "name": "Custom Merge View",
    "fields": [
      { "label": "ID",          "path": "$.id" },
      { "label": "First Name",  "path": "$.name[0].given[0]" },
      { "label": "Last Name",   "path": "$.name[0].family" },
      { "label": "Gender",      "path": "$.gender" },
      { "label": "Birth Date",  "path": "$.birthDate" },
      { "label": "Phone",       "path": "$.telecom[?(@.system==\"phone\")].value" },
      { "label": "Email",       "path": "$.telecom[?(@.system==\"email\")].value" }
    ]
  }'::jsonb
);
```

Then set the environment variable for the MDM **frontend** service:

```bash
MERGE_VIEW_MODEL_ID=my-merge-view
```

After restarting the service, the merge UI will display the configured fields.

## Field descriptor format

Each entry in the `fields` array has two properties:

| Property | Type | Description |
|----------|------|-------------|
| `label` | string | Display name shown in the merge UI |
| `path` | string | JSONPath expression for reading and writing the value |

The same JSONPath expression is used for both **reading** the value from each patient and **writing** the selected value into the merge result. The order of fields in the array determines the display order in the UI.

## Supported JSONPath expressions

Field paths use [JSONPath](https://goessner.net/articles/JsonPath/) syntax compatible with the `jsonpath-plus` library. Examples:

| Path | Description |
|------|-------------|
| `$.id` | Patient ID |
| `$.name[0].given[0]` | First given name |
| `$.name[0].given[1]` | Second given name (middle name) |
| `$.name[0].family` | Family name |
| `$.gender` | Gender |
| `$.birthDate` | Date of birth |
| `$.address[0].line[0]` | First address line |
| `$.address[0].line[1]` | Second address line |
| `$.address[0].city` | City |
| `$.address[0].state` | State |
| `$.address[0].postalCode` | ZIP / postal code |
| `$.telecom[?(@.system=="phone")].value` | Phone number (filter expression) |
| `$.telecom[?(@.system=="email")].value` | Email address (filter expression) |

{% hint style="info" %}
Filter expressions like `[?(@.system=="phone")]` let you target specific entries in arrays based on a condition, rather than relying on a fixed array index.
{% endhint %}

## Default fields

When no MergeViewModel is configured, the system uses the following default fields:

| Label | Path |
|-------|------|
| ID | `$.id` |
| First Name | `$.name[0].given[0]` |
| Second Name | `$.name[0].given[1]` |
| Last Name | `$.name[0].family` |
| Gender | `$.gender` |
| Birth Date | `$.birthDate` |

## Merge UI behavior

The merge view displays each configured field as a row with values from both patient records:

- If both patients have the **same value** for a field, it is displayed without a selection control.
- If the values **differ**, radio buttons allow the clinician to pick which value to keep in the merged result.
- If a JSONPath expression resolves to **no value** in one or both patients, an empty string is shown.

The clinician can also select an entire patient column at once using the header radio buttons, which copies all field values from that patient into the merge result.

## Update a MergeViewModel

To change the field configuration, update the record in the database:

```sql
UPDATE mpi.mergeviewmodel
SET resource = '{
  "id": "my-merge-view",
  "name": "Updated Merge View",
  "fields": [
    { "label": "ID",          "path": "$.id" },
    { "label": "First Name",  "path": "$.name[0].given[0]" },
    { "label": "Last Name",   "path": "$.name[0].family" },
    { "label": "Birth Date",  "path": "$.birthDate" }
  ]
}'::jsonb,
version = version + 1
WHERE id = 'my-merge-view';
```

Changes take effect on the next merge page load — no redeployment is required.

## Database schema

The MergeViewModel is stored in two tables:

**`mpi.mergeviewmodel`** — active configuration:

| Column | Type | Description |
|--------|------|-------------|
| `id` | `text` (PK) | Unique identifier |
| `version` | `integer` | Incremented on each update |
| `cts` | `timestamptz` | Created / last updated timestamp |
| `resource` | `jsonb` | Configuration including the `fields` array |

**`mpi.mergeviewmodel_history`** — audit trail of previous versions:

| Column | Type | Description |
|--------|------|-------------|
| `id` | `text` | Record identifier |
| `version` | `integer` | Version number |
| `cts` | `timestamptz` | Timestamp of this version |
| `resource` | `jsonb` | Configuration snapshot |
| | | UNIQUE (`id`, `version`) |
