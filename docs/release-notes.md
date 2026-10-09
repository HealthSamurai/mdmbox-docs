---
description: New features, improvements, and changes in MDMbox releases.
---

# Release notes

Release notes are grouped by monthly version. Each version lists compatible Aidbox monthly versions. See [Versions and compatibility](deployment/versions-and-compatibility.md) for the supported range and Docker release tags.

## October 2026 (edge)

**Docker tag:** `edge`

**Upcoming improvements**

* **[Aidbox App integration](authentication.md#admin-ui-through-aidbox)** — Improved delivery of CSV exports and incremental Admin UI updates through Aidbox Apps. With Aidbox's response streaming, bulk and continuous matching downloads begin before the complete file is generated, and UI events arrive as MDMbox sends them. Aidbox no longer holds the complete response body in memory.

Response streaming is planned for Aidbox `2610`. We recommend Aidbox `2610` or later for App integration once that release is available. Earlier supported Aidbox versions continue to serve the UI and downloads with buffered responses; see [App integration compatibility](deployment/versions-and-compatibility.md#aidbox-app-integration).

## September 2026

**Planned Docker tag:** `2609`

**Target Aidbox compatibility:** `2605` through `2609`. The release test matrix confirms the supported versions when the image is published.

**Features and improvements**

* **[Admin UI through Aidbox](authentication.md#admin-ui-through-aidbox)** — Open MDMbox at `/mdmbox` on the Aidbox address. Aidbox handles browser sign-in, sign-out, and UI authorization through AccessPolicies. Anonymous browser navigation redirects to Aidbox login and returns to the requested page after sign-in. Direct UI access to MDMbox returns HTTP 403; a separate MDMbox UI role or login is no longer required.
* **Automatic App setup** — MDMbox registers `App/mdmbox` and its UI, API, and Swagger operations at startup, keeping the App secret across restarts. It seeds policies for the login redirect and public API documentation. `MDMBOX_ADMIN_ID` and `MDMBOX_ADMIN_PASSWORD` create an initial Aidbox user and a UI AccessPolicy; existing policies are preserved.
* **Shared database startup** — Fixed fresh MDMbox installation when Aidbox has already initialized the shared database.
* **[API access through Aidbox](authentication.md#api-through-aidbox)** — The App exposes MDMbox operations at `/api/*` on Aidbox. Set `MDMBOX_API_AIDBOX_APP_ONLY=true` to enforce Aidbox AccessPolicies by rejecting direct protected API requests with HTTP 403. MDMbox verifies App credentials and uses the identity authenticated by Aidbox.
* **[Continuous matching](continuous-matching.md)** — A persistent process matches existing records and keeps its results current as records are inserted, updated, and deleted. Changes to prepared fields recompute affected matches and weights; deletions retract pairs, while manual decisions and merge history remain available. Pause and Resume retain completed results and captured changes; active processes recover after restarts and hand over during rolling updates. The Admin UI shows separate change-application and matching progress with batch diagnostics. Download CSV or NDJSON, or browse results as paginated JSON with a decision-status filter.

**Configuration and upgrade changes**

* Set the same `BOX_WEB_BASE_URL` in Aidbox and MDMbox. MDMbox now requires this public Aidbox URL at startup; the legacy `AIDBOX_BASE_URL` alias is accepted, while `MDMBOX_AIDBOX_URL` is no longer used.
* Set `MDMBOX_AIDBOX_APP_ENDPOINT_URL` to the MDMbox endpoint reachable from Aidbox. Its default is `http://mdmbox:3000/api/aidbox-app-proxy`; Kubernetes deployments should use their MDMbox Service address.
* Replace direct Admin UI links with the Aidbox `/mdmbox` address. `MDMBOX_ADMIN_ROLE`, the separate UI Client, and MDMbox browser sessions are no longer used. Configure UI and App API access with Aidbox AccessPolicies.
* Direct API authentication remains enabled by default and supports Basic Client credentials, Aidbox access tokens, and external JWT validation. `MDMBOX_API_AIDBOX_APP_ONLY` defaults to `false`; enable it when all protected API access must go through Aidbox.
* Continuous processes created by versions that captured only inserts rebuild prepared data and results on their first Start or automatic recovery after the upgrade. Automatic recovery uses the saved model version and includes earlier updates and deletions. See [Continuous matching upgrades](continuous-matching.md#deployment-and-upgrades).

See [Authentication](authentication.md), [Configuration reference](config-reference.md), and [Continuous matching](continuous-matching.md) for setup, API behavior, and upgrade guidance.

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
