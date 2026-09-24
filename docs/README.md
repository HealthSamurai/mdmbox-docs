---
description: MDMbox adds probabilistic record matching, deduplication, and merging workflows to Aidbox.
---

# MDMbox

MDMbox finds duplicate FHIR records and helps you resolve them. A matching model defines how to compare fields such as names, dates of birth, and addresses. MDMbox scores candidate pairs; your application or a reviewer decides what to do with them.

## Core capabilities

| You want to… | Use |
| --- | --- |
| Find duplicates of one record | [$match](match-operation.md) |
| Find duplicate pairs in an existing dataset | [Bulk matching](bulk-match.md) |
| Match existing data and keep processing new records | [Continuous matching](continuous-matching.md) |
| Combine duplicates into one surviving record | [Merge](merge-operation.md) and [unmerge](unmerge-operation.md) |
| Group records while keeping the originals | [Link](link-operation.md) and [unlink](unlink-operation.md) |
| Record that two records are different entities | [$mark-not-a-match](mark-not-a-match.md) |
| Inspect who performed an operation and what changed | [Audit](audit.md) |

The Admin UI manages models, matching jobs, continuous processes, and merge/unmerge algorithms. Bulk and Continuous matching export pairs as CSV or NDJSON; they do not merge records automatically. For an application that reviews pairs and resolves them, see the [Data Steward UI example](https://github.com/HealthSamurai/mdmbox-playground/tree/main/examples/data-steward-ui).

## Deployment architecture

MDMbox is deployed together with Aidbox. They run as separate services and connect to the same PostgreSQL database, so MDMbox operations work with the FHIR resources stored in Aidbox.

Aidbox provides the FHIR API and storage platform. MDMbox provides matching, linking, merging, bulk matching, and its Admin UI.

Start with the [Docker Compose walkthrough](getting-started.md), which includes compatible versions and shared configuration. Matching models can target Patient, Practitioner, Organization, or another supported FHIR resource type.

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
