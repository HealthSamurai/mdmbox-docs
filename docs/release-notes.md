---
description: New features, improvements, and changes in MDMbox releases.
---

# Release notes

Release notes are grouped by monthly version. Each version lists compatible Aidbox monthly versions. See [Versions and compatibility](deployment/versions-and-compatibility.md) for the supported range and Docker release tags.

## Unreleased

* **[SQL functions](sql-functions.md)** — Matching helpers use the canonical names `mdm_unaccent`, `mdm_unaccent_upper`, `mdm_unaccent_upper_no_spaces`, and `mdm_jaro_winkler` in `public`. Upgrades retain installed legacy names for existing models and SQL dependencies. Clean installations create only canonical names; use them when importing older models.

## August 2026

**Docker tags:** `2608`, `latest`

**Compatible Aidbox versions:** `2605`, `2606`, `2607`, `2608`.

**Improvements**

* **[Server-managed merge](merge-operation.md#reference-search-indexes)** — Reference discovery can use type-specific GIN expression indexes on related-resource tables, including nested references. Create the matching indexes in the resource database to accelerate large-table searches; the documentation includes an Encounter-to-Patient index example.
* **[Bulk matching](bulk-match.md)** — Start prepares data when needed, then runs matching. Changes to scoring rules reuse prepared data; index changes update only indexes.
* Bulk matching commands and status responses now use FHIR `Parameters`. Status includes job progress, and `/status/{job-id}` lets you follow a specific job.

**API changes**

* Replace calls to `/api/bulk-match/{model-id}/prepare` with `/api/bulk-match/{model-id}/start`. To rebuild prepared data, pass `{"refreshSourceData": true}` to Start. Update response parsing to read FHIR parameters by `name`; see the [Bulk matching API examples](bulk-match.md#api-workflow).

**UI changes**

* **Admin navigation** — New sidebar navigation groups Models, Matching, and Algorithms, with separate Merge and Unmerge pages.
* **[Bulk matching](bulk-match.md#admin-ui)** — Separate **Start job** and **Refresh and start** actions let you reuse prepared data or rebuild it from current source records. Job activity shows per-worker timelines, batch details, and paginated batch history.
