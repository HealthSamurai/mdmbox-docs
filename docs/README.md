---
description: MDMbox is a standalone service for probabilistic record matching, deduplication, and merging of FHIR resources.
---

# MDMbox

MDMbox is a master data management service for healthcare organizations. It identifies duplicate records across FHIR resources using probabilistic matching and provides tools to merge and manage them.

## Core capabilities

**Probabilistic matching.** Configurable Fellegi-Sunter models compare records across multiple dimensions (name, date of birth, address, phone) and produce a match score. Handles typos, incomplete data, and transpositions.

**Merging.** FHIR R5-aligned `$merge` operation with a client-driven approach -- the client builds the merge plan as a FHIR transaction Bundle, giving full control over which fields survive and how related resources are reassigned. Full audit trail and preview mode.

**Bulk matching.** Find all duplicate pairs across millions of records in parallel. Download results as CSV.

**Admin UI.** Server-rendered interface for managing matching models and running bulk match jobs.

**FHIR R4 to R6.** Matching, merging, and referencing operations work with any FHIR resource type -- Patient, Practitioner, Organization, or any other. Configure a matching model for the resource type you need.

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
