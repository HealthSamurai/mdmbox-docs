---
description: MDMbox adds probabilistic record matching, deduplication, and merging workflows to Aidbox.
---

# MDMbox

MDMbox finds duplicate FHIR records and helps you resolve them. A matching model defines how to compare fields such as names, dates of birth, and addresses. MDMbox scores candidate pairs; your application or a reviewer decides what to do with them.

Start with [Getting started](getting-started.md) to run MDMbox locally and try matching in the UI. For an existing Aidbox installation, see [Kubernetes deployment](deployment/kubernetes.md). See [Release notes](release-notes.md) for available releases and Aidbox compatibility.

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

The Admin UI manages models, matching jobs, continuous processes, and merge/unmerge algorithms. Bulk and Continuous matching export pairs as CSV or NDJSON for review and resolution. See the [Data Steward UI example](https://github.com/HealthSamurai/mdmbox-playground/tree/main/examples/data-steward-ui) for a complete review workflow.

## Deployment architecture

MDMbox and [Aidbox](https://www.health-samurai.io/docs/aidbox) run as separate services connected to the same PostgreSQL database. MDMbox operates on the FHIR records stored there; use Aidbox's FHIR API to manage those records.

See [Versions and compatibility](deployment/versions-and-compatibility.md) for image tags and shared configuration. Matching models can target Patient, Practitioner, Organization, or another supported FHIR resource type.

## Explore the documentation

- **Matching:** configure [Matching models](matching-models.md), choose a matching workflow from the table above, and understand scores in [Mathematical details](mathematical-details.md).
- **Duplicate resolution:** merge or link confirmed duplicates, reverse a previous decision, or [mark a pair as not a match](mark-not-a-match.md). Use [$referencing](referencing-operation.md) to find related records before building a merge plan.
- **Customizing merge and unmerge:** manage built-in and custom scripts in [Algorithm management](algorithms.md), then use the [JavaScript algorithm API](javascript-algorithm-api.md) to implement your merge and unmerge policy.
- **Deployment:** choose [compatible versions](deployment/versions-and-compatibility.md), deploy with [Kubernetes](deployment/kubernetes.md), and [update MDMbox](deployment/updating-mdmbox.md).
- **Operations:** set environment variables in [Configuration reference](config-reference.md), configure [Authentication](authentication.md), and inspect the [Audit](audit.md) trail.
- **API and integrations:** find endpoints in [API reference](api-reference.md) and subscribe to merge and unmerge events with [Notifications](notifications.md).
