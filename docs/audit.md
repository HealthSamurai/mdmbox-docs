---
description: Inspect MDM operation events, resource history, and audit persistence guarantees.
---

# Audit

MDMbox automatically records operations as FHIR R4 `AuditEvent` resources in the shared database. Read, search, and export them through the [Aidbox FHIR API](https://www.health-samurai.io/docs/aidbox/api/rest-api/fhir-search).

## Querying the audit

Send audit queries to the Aidbox host:

```http
GET https://<aidbox-host>/fhir/AuditEvent?source=Device/mdmbox
GET https://<aidbox-host>/fhir/AuditEvent?source=Device/mdmbox&subtype=merge&entity=Patient/123
GET https://<aidbox-host>/fhir/AuditEvent?source=Device/mdmbox&subtype=continuous-match-start
GET https://<aidbox-host>/fhir/AuditEvent?source=Device/mdmbox&entity:identifier=https://mdm.health-samurai.io/fhir/NamingSystem/bulk-match-job|123
GET https://<aidbox-host>/fhir/Provenance?target=Task/<task-id>
```

For failed attempts, request references are stored as identifiers because the referenced resource may not exist. To find failures involving a record, use `entity:identifier`:

```http
GET https://<aidbox-host>/fhir/AuditEvent?source=Device/mdmbox&entity:identifier=https://mdm.health-samurai.io/fhir/NamingSystem/fhir-reference|Patient/123
```

## Covered operations

| Operation | Successful audit records |
| --- | --- |
| `$merge`, `$merge/v2`, `$unmerge`, `$unmerge/v2` | Operation `Task`, `Provenance`, and `AuditEvent`, committed with the business changes |
| `$link`, `$unlink` | Operation `Task`, `Provenance`, and `AuditEvent`, committed with the business changes |
| `$match`, including R4/R6 and instance-level routes | `AuditEvent` identifying the path subject when present and resources returned to the caller |
| `$referencing` | `AuditEvent` identifying the subject and resources returned to the caller |
| `$mark-not-a-match` | Assertion `Task` and `AuditEvent` in one transaction; a repeated assertion reuses the Task and creates another event |
| Bulk matching and Continuous matching commands, through API and Admin UI | Required request `AuditEvent` before execution, then a separate acceptance event |
| Bulk status API and CSV/NDJSON downloads, including Admin UI downloads | Required access `AuditEvent` before returning status or opening the result stream |
| Bulk Admin UI pages, initialization, model selection, and query preview | One completion or failure event; page and initialization events are coalesced |
| Algorithm catalogs, detail, configuration, and Git source detail | One completion or failure event |
| Algorithm and Git source create/update/delete; manual Git synchronization | Required request event and a separate result; manual sync also records its background completion or failure |
| Onboarding | Page/init and each step; patient import and model installation require a request event before execution |
| Login page, login, logout | Page view and the result of each login/logout attempt |
| Automatic bulk and Git source status polling | Failures only, with repeated equivalent failures throttled |

Failed attempts are also audited, including validation errors, conflicts, authentication rejections, and server errors. Malformed JSON on audited endpoints is recorded without a verified caller identity.

### Bulk operation codes

The same codes identify API and Admin UI actions:

| Workflow | Codes |
| --- | --- |
| Bulk matching | `bulk-match-start`, `bulk-match-stop`, `bulk-match-continue`, `bulk-match-archive`, `bulk-match-status`, `bulk-match-result` |
| Continuous matching | `continuous-match-start`, `continuous-match-pause`, `continuous-match-retry`, `continuous-match-delete`, `continuous-match-status`, `continuous-match-result` |
| Bulk matching UI | `bulk-match-view` (page/init), `bulk-match-select-model`, `bulk-match-preview-query`, `bulk-match-poll` (failures only) |
| Continuous matching UI | `continuous-match-view` (page/init), `continuous-match-select-model`, `continuous-match-poll` (failures only) |

Force stop uses `bulk-match-stop` with a `force` entity. Preparation uses `bulk-match-start`. Bulk events identify the model and job through `entity.what.identifier`:

| Object | Identifier system | Value |
| --- | --- | --- |
| Model | `https://mdm.health-samurai.io/fhir/NamingSystem/fhir-reference` | `BulkMatchingModel/<id>` |
| Job | `https://mdm.health-samurai.io/fhir/NamingSystem/bulk-match-job` | Numeric job ID as a string |

Export events identify the selected job rather than individual patient pairs.

### Other Admin UI operation codes

| Workflow | Codes |
| --- | --- |
| Algorithms | `algorithm-view` (page/list), `algorithm-detail`, `algorithm-configuration-view`, `algorithm-create`, `algorithm-update`, `algorithm-delete` |
| Git sources | `git-source-detail`, `git-source-create`, `git-source-update`, `git-source-delete`, `git-source-sync`, `git-source-poll` (failures only) |
| Onboarding | `onboarding-view` (page/init), `onboarding-seed-patients`, `onboarding-skip-step1`, `onboarding-install-model`, `onboarding-pick-patient`, `onboarding-run-tests` |
| Session | `login-view`, `login`, `logout` |

Algorithm events include an `algorithm-operation` entity (`merge` or `unmerge`) and, when supplied, an identifier such as `merge/my-algorithm` with system `https://mdm.health-samurai.io/fhir/NamingSystem/algorithm`. Git source identifiers use system `https://mdm.health-samurai.io/fhir/NamingSystem/algorithm-git-source`. Scripts, repository URLs, credential paths, tokens, passwords, SQL previews, and onboarding patient payloads are not copied into these events.

### Controlling event volume

Explicit actions and login/logout attempts are recorded individually. Repeated page views and polling failures are coalesced to reduce noise; successful automatic polling is omitted. An event can include `suppressed-repeats` with the number of coalesced requests. Use these events to review activity, rather than count every page request.

## What each record contains

`AuditEvent` records the operation code, timestamp, outcome, initiating actor when available, and affected resource references. Its `source.observer` is `Device/mdmbox`. Successful events use `outcome=0`; failed requests below HTTP 500 use `outcome=4`, and server errors use `outcome=8`. Failure descriptions contain the HTTP status and an OperationOutcome issue code when available, rather than response diagnostics.

The authenticated initiator is selected from the verified authentication context in this order:

1. A local Aidbox `User.id`, represented as an identifier with value `User/<id>`.
2. An external JWT with both `iss` and `sub`, represented with `iss` as the identifier system and `sub` as its value. A local User is not required.
3. An authenticated Aidbox `Client.id`, represented as an identifier with value `Client/<id>`.

Local user and client identifiers use the system `https://mdm.health-samurai.io/fhir/NamingSystem/security-principal`. The initiator has `requestor=true`; `Device/mdmbox` is recorded as a separate service agent. When there is no resolvable verified initiator, including when authentication is disabled, only the service agent is recorded, with `requestor=true`. Unverified token claims are never used to identify a caller.

Admin UI events use the verified session identity. Rejected sessions and failed UI actions are recorded as failures, including when the browser receives a redirect or an HTTP 200 response containing an error notification.

When an initiator is available, its network address is the direct connection peer. Behind a proxy, this can be the proxy's address; forwarded IP headers are not used. Events also carry a request correlation identifier. Direct requests preserve `X-Request-Id` values containing 1–200 characters from `A-Z`, `a-z`, `0-9`, `.`, `_`, `:`, and `-`; otherwise MDMbox generates one. The response returns it as `X-Request-Id`.

Events contain operation metadata and resource identities; credentials and complete request/response bodies are excluded. Read events include up to 1000 distinct returned resource references. `outcomeDesc` reports any omitted references; the operation response remains complete.

## Resource changes and reversal

For merge, unmerge, link, and unlink, the three records have different purposes:

| Resource | Purpose |
| --- | --- |
| `Task` | Operation inputs and lifecycle, such as `merged`, `unmerged`, `linked`, or `unlinked` |
| `Provenance` | Affected resources and versioned references to pre-change revisions when available |
| `AuditEvent` | Initiator, outcome, service, correlation, and links to the operation Task, Provenance, and domain resources |

`Provenance.agent` currently identifies `Device/mdmbox`; the initiating user or client is recorded in the linked AuditEvent. AuditEvent domain references are unversioned. Server-managed merge additionally records actual post-change versions in Provenance and the executed algorithm's identity in Task, including the script SHA-256 and Git revision when applicable. See [Merge operation](merge-operation.md) and [Unmerge operation](unmerge-operation.md) for version and retention requirements.

## Persistence guarantees

Successful merge, unmerge, link, and unlink events commit in the same transaction as their business changes, Task, and Provenance. If any part fails, the entire transaction rolls back, including its success event. A new not-a-match assertion likewise commits its Task and event together. Reusing an assertion still requires a successful audit write.

`$match` and `$referencing` must persist their event before returning data. If the audit write fails, the operation returns HTTP 500 with an OperationOutcome instead of disclosing the result.

Bulk commands require a durable request event (`outcomeDesc="Bulk command requested"`, with `outcome` omitted) before execution. A separate acceptance event (`outcome=0`, `outcomeDesc="Bulk command accepted"`) confirms that the command was accepted; check job or process status for background completion. Both events share the request correlation identifier. Acceptance events are best-effort: if only the request is present, inspect the current state before retrying.

Bulk status and exports require an event with `outcomeDesc="Bulk data access authorized"` before returning data. An audit write failure returns HTTP 500. Export events record access when the stream opens; later streaming errors appear in the application log.

Algorithm and Git source changes, manual Sync, onboarding import, and model installation require a durable `UI command requested` event before execution. Their `UI interaction completed` result is best-effort, as are page views, reads, other onboarding steps, and login/logout events.

Manual Git Sync also records a best-effort background result: `Git synchronization completed` (`outcome=0`) or `Git synchronization failed` (`outcome=8`). Check the source state before retrying a sync with no result event. Onboarding tests produce the usual `$match` events.

Failure events are best-effort and survive business transaction rollback when stored successfully. Failed audit writes preserve the original error response and appear in the application log under `Failed to persist operation AuditEvent`. Monitor these logs for lost events; MDMbox does not retry them automatically.

Merge, unmerge, link, and unlink previews leave no operation audit event. Authentication failures and malformed JSON remain audited. `$match`, `$referencing`, and `$mark-not-a-match` are always audited.

## Access, retention, and export

MDM operation plans protect server-managed Task, Provenance, AuditEvent, and Device resources from modification. Configure [Aidbox access policies](https://www.health-samurai.io/docs/aidbox/access-control/authorization/access-policies) to restrict direct changes through its API.

Export events through FHIR search and configure retention and backups according to your deployment policy. Keep the Task, Provenance, and FHIR history versions required for unmerge.
