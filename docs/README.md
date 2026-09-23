---
description: MDMbox adds probabilistic record matching, deduplication, and merging workflows to Aidbox.
---

# MDMbox

MDMbox is a master data management service for healthcare organizations. It identifies duplicate records across FHIR resources using probabilistic matching and provides tools to merge and manage them.

## Core capabilities

**Probabilistic matching.** Configurable Fellegi-Sunter models compare records across multiple dimensions (name, date of birth, address, phone) and produce a match score. Handles typos, incomplete data, and transpositions.

**Merging.** FHIR R5-aligned merge lifecycle with server-managed `$merge/v2` and `$unmerge/v2` operations, plus client-plan `$merge` and `$unmerge` endpoints for callers that need full control over the transaction Bundle. Both modes provide an atomic audit trail and write-free preview.

**Audit.** Automatic FHIR AuditEvents record matching, referencing, merge/unmerge, link/unlink, not-a-match, bulk workflows and exports, algorithm and Git source administration, manual synchronization, onboarding, and login/logout. Commands require a durable request event before execution; results are recorded separately. Successful UI polling creates no events, and repeated polling failures are throttled. See [Audit](audit.md) for exact coverage, persistence guarantees, and queries.

**Bulk and Continuous matching.** Find duplicate pairs across a prepared dataset, or keep matching newly inserted records. Export results as CSV or NDJSON.

**Admin UI.** Manage matching models, run bulk matching jobs, and control continuous matching processes.

**FHIR R4 to R6.** Matching, merging, and referencing operations work with any FHIR resource type — Patient, Practitioner, Organization, or any other. Configure a matching model for the resource type you need.

## Deployment architecture

MDMbox is deployed together with Aidbox. They run as separate services and connect to the same PostgreSQL database, so MDMbox operations work with the FHIR resources stored in Aidbox.

Aidbox provides the FHIR API and storage platform. MDMbox provides matching, linking, merging, bulk matching, and its Admin UI.

Each MDMbox release is tested against multiple Aidbox versions. Choose a tested Aidbox version from the MDMbox image's compatibility label and pass the same database connection and relevant `BOX_FHIR_*` settings to both services.

{% content-ref %}
[Getting started](getting-started.md)
{% endcontent-ref %}

{% content-ref %}
[Release notes](release-notes.md)
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
