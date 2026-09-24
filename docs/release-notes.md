---
description: New features, improvements, and changes in MDMbox releases.
---

# Release notes

## August 2026 _`2608`_

### 2608.1

**Improvements**

* **[Bulk matching](bulk-match.md)** — Start prepares data when needed, then runs matching. Changes to scoring rules reuse prepared data; index changes update only indexes. Use **Refresh source data** to include changed source records.
* Bulk and Continuous matching commands and status responses now use FHIR `Parameters`, with shared names for state and progress. Bulk status includes job progress, and `/status/{job-id}` lets you follow a specific job.

**API changes**

* Replace calls to `/api/bulk-match/{model-id}/prepare` with `/api/bulk-match/{model-id}/start`. To rebuild prepared data, pass `{"refreshSourceData": true}` to Start. Update response parsing to read FHIR parameters by `name`; see the [Bulk](bulk-match.md#api-workflow) and [Continuous](continuous-matching.md#api) examples.

### 2608.0

**Features**

* **[Continuous matching](continuous-matching.md)** — find duplicate pairs in existing data and keep matching newly inserted records. Pause and resume processing from the Admin UI, and export accumulated results as CSV or NDJSON.
