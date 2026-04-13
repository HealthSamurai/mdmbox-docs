---
description: MDMbox is a standalone service for probabilistic record matching, deduplication, and merging of FHIR resources.
---

# MDMbox

MDMbox is a master data management service for healthcare organizations. It identifies duplicate records across FHIR resources using probabilistic matching and provides tools to merge and manage them.

## Core capabilities

**Probabilistic matching.** Configurable Fellegi-Sunter models compare records across multiple dimensions (name, date of birth, address, phone) and produce a match score. Handles typos, incomplete data, and transpositions.

**Merging.** Client-driven merge with a FHIR transaction Bundle. Full audit trail via Task and Provenance resources. Preview mode for dry runs.

**Bulk matching.** Pre-materialize data into a flat table, then run parallel workers to find all duplicate pairs across millions of records. Download results as CSV.

**Admin UI.** Server-rendered interface for managing matching models and running bulk match jobs.

**FHIR R4.** All operations use standard FHIR resource types and follow FHIR conventions. Works with any resource type (Patient, Practitioner, Organization, etc.).

## Deployment modes

MDMbox runs as a single Docker container with an embedded FHIR engine. It connects to a PostgreSQL database.

**Standalone** -- MDMbox manages its own database. Deploy MDMbox and PostgreSQL, and you are ready to go.

**Shared with Aidbox** -- MDMbox connects to an existing Aidbox database. Both services share the same PostgreSQL instance and FHIR data. Pass the same `BOX_*` environment variables to both services.

{% content-ref %}
[Getting started](getting-started.md)
{% endcontent-ref %}

{% content-ref %}
[Matching models](matching-models.md)
{% endcontent-ref %}

{% content-ref %}
[Find duplicates: $match](match-operation.md)
{% endcontent-ref %}

{% content-ref %}
[Bulk matching](bulk-match.md)
{% endcontent-ref %}

{% content-ref %}
[Merge operation](merge-operation.md)
{% endcontent-ref %}

{% content-ref %}
[Mathematical details](mathematical-details.md)
{% endcontent-ref %}

{% content-ref %}
[API reference](api-reference.md)
{% endcontent-ref %}
