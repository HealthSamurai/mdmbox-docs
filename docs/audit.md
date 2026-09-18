---
description: Inspect MDM operation events, resource history, and audit persistence guarantees.
---

# Audit

MDMbox automatically records the operations listed below as FHIR R4 `AuditEvent` resources in the shared Aidbox database. This operation audit is always active; it has no separate enable/disable setting. Read and search the records through the Aidbox FHIR API. MDMbox does not currently provide an Audit page in its Admin UI.

## Covered operations

| Operation | Successful audit records |
| --- | --- |
| `$merge`, `$merge/v2`, `$unmerge`, `$unmerge/v2` | Operation `Task`, `Provenance`, and `AuditEvent`, committed with the business changes |
| `$link`, `$unlink` | Operation `Task`, `Provenance`, and `AuditEvent`, committed with the business changes |
| `$match`, including R4/R6 and instance-level routes | `AuditEvent` identifying the path subject when present and resources returned to the caller |
| `$referencing` | `AuditEvent` identifying the subject and resources returned to the caller |
| `$mark-not-a-match` | Assertion `Task` and `AuditEvent` in one transaction; a repeated assertion reuses the Task and creates another event |
| Bulk matching v1 and continuous bulk matching v2 commands, through API and Admin UI | Required request `AuditEvent` before execution, then a separate acceptance event |
| Bulk status API and CSV/NDJSON downloads, including Admin UI downloads | Required access `AuditEvent` before returning status or opening the result stream |
| Bulk Admin UI pages, initialization, model selection, and query preview | One completion or failure event; page and initialization events are coalesced |
| Algorithm catalogs, detail, configuration, and Git source detail | One completion or failure event |
| Algorithm and Git source create/update/delete; manual Git synchronization | Required request event and a separate result; manual sync also records its background completion or failure |
| Onboarding | Page/init and each step; patient import and model installation require a request event before execution |
| Login page, login, logout | Page view and the result of each login/logout attempt |
| Automatic bulk and Git source status polling | Failures only, with repeated equivalent failures throttled |

Failed attempts on these endpoints are also audited, including validation errors, conflicts, authentication rejections, and server errors. Malformed JSON is recorded when its URL and HTTP method identify an audited endpoint. Since parsing precedes authentication, that event has no verified caller identity.

### Bulk operation codes

The same codes identify API and Admin UI actions:

| Workflow | Codes |
| --- | --- |
| Bulk matching jobs (v1) | `bulk-match-prepare`, `bulk-match-start`, `bulk-match-stop`, `bulk-match-continue`, `bulk-match-archive`, `bulk-match-status`, `bulk-match-download`, `bulk-match-pairs` |
| Continuous matching (v2) | `bulk-match-v2-start`, `bulk-match-v2-pause`, `bulk-match-v2-retry`, `bulk-match-v2-delete`, `bulk-match-v2-status`, `bulk-match-v2-pairs` |
| Bulk UI (v1) | `bulk-match-view` (page/init), `bulk-match-select-model`, `bulk-match-preview-query`, `bulk-match-poll` (failures only) |
| Bulk UI (v2) | `bulk-match-v2-view` (page/init), `bulk-match-v2-select-model`, `bulk-match-v2-poll` (failures only) |

Force stop uses `bulk-match-stop`; force prepare and force stop carry a `force` entity on their request and acceptance events. Bulk events identify the model and job when known. The model uses `entity.what.identifier` with system `https://mdm.health-samurai.io/fhir/NamingSystem/fhir-reference` and value `BulkMatchingModel/<id>`. A v1 job uses system `https://mdm.health-samurai.io/fhir/NamingSystem/bulk-match-job` and its numeric ID as a string. Export events identify the resolved job, including downloads that select the latest finished job implicitly. Events do not enumerate the exported patient pairs.

### Other Admin UI operation codes

| Workflow | Codes |
| --- | --- |
| Algorithms | `algorithm-view` (page/list), `algorithm-detail`, `algorithm-configuration-view`, `algorithm-create`, `algorithm-update`, `algorithm-delete` |
| Git sources | `git-source-detail`, `git-source-create`, `git-source-update`, `git-source-delete`, `git-source-sync`, `git-source-poll` (failures only) |
| Onboarding | `onboarding-view` (page/init), `onboarding-seed-patients`, `onboarding-skip-step1`, `onboarding-install-model`, `onboarding-pick-patient`, `onboarding-run-tests` |
| Session | `login-view`, `login`, `logout` |

Algorithm events include an `algorithm-operation` entity (`merge` or `unmerge`) and, when supplied, an identifier such as `merge/my-algorithm` with system `https://mdm.health-samurai.io/fhir/NamingSystem/algorithm`. Git source identifiers use system `https://mdm.health-samurai.io/fhir/NamingSystem/algorithm-git-source`. Scripts, repository URLs, credential paths, tokens, passwords, SQL previews, and onboarding patient payloads are not copied into these events.

### Controlling event volume

Successful page and automatic initialization/list requests share one operation code and are coalesced over five seconds. This also applies to repeated page refreshes; it is not an exact browser-session or page-opening counter. Explicit actions such as model selection and query preview are recorded individually. One SSE interaction produces one result event, not one event per fragment or signal update.

Successful bulk and Git source status polling creates no events. The first polling failure is recorded immediately; equivalent repeats are suppressed for 60 seconds. This includes authentication failures before the SSE handler starts. Equivalence uses the operation, outcome/status, verified actor, direct connection peer, and safe object identifiers, excluding the request correlation ID. A different error or object can therefore produce another event within the same minute.

Coalescing state is local to each MDMbox process, holds at most 4096 keys, and resets on restart. Eviction can admit another event earlier. When a retained window expires, the next recorded event includes an entity named `suppressed-repeats` if repeats were suppressed. This is a best-effort noise limit, not a durable count of every request. Login/logout attempts and explicit commands are not throttled.

## What each record contains

`AuditEvent` records the operation code, timestamp, outcome, initiating actor when available, and affected resource references. Its `source.observer` is `Device/mdmbox`. Successful events use `outcome=0`; failed requests below HTTP 500 use `outcome=4`, and server errors use `outcome=8`. Failure descriptions contain the HTTP status and an OperationOutcome issue code when available, rather than response diagnostics.

The authenticated initiator is selected from the verified authentication context in this order:

1. A local Aidbox `User.id`, represented as an identifier with value `User/<id>`.
2. An external JWT with both `iss` and `sub`, represented with `iss` as the identifier system and `sub` as its value. A local User is not required.
3. An authenticated Aidbox `Client.id`, represented as an identifier with value `Client/<id>`.

Local user and client identifiers use the system `https://mdm.health-samurai.io/fhir/NamingSystem/security-principal`. The initiator has `requestor=true`; `Device/mdmbox` is recorded as a separate service agent. When there is no resolvable verified initiator, including when authentication is disabled, only the service agent is recorded, with `requestor=true`. Unverified token claims are never used to identify a caller.

For audited Admin UI actions, the initiator comes from the session's verified `/auth/userinfo` response and uses the same local User or Client identifier format. Successful login and logout use verified session identity when available; rejected credentials and unverifiable sessions do not acquire an identity from submitted usernames. A rejected browser session is recorded as an authentication failure even when the HTTP response redirects to login. Failures of the session verification service return HTTP 500 and trigger a failure-audit attempt. Errors shown as SSE toasts or failed onboarding signals are recorded as failures, independently of the SSE connection's HTTP 200 status.

When an initiator is available, its network address is the direct connection peer. Behind a proxy, this can be the proxy's address; forwarded IP headers are not used. Events also carry a request correlation identifier. Direct requests preserve `X-Request-Id` values containing 1–200 characters from `A-Z`, `a-z`, `0-9`, `.`, `_`, `:`, and `-`; otherwise MDMbox generates one. The response returns it as `X-Request-Id`.

Operation events do not copy credentials or complete request/response bodies. A match event records returned resource identities, not the submitted demographics, matching scores, or a complete explanation of the matching decision. Read-operation events record at most 1000 distinct returned resource references; `outcomeDesc` reports how many additional references were omitted. This limit does not truncate the actual operation response.

## Resource changes and reversal

For merge, unmerge, link, and unlink, the three records have different purposes:

| Resource | Purpose |
| --- | --- |
| `Task` | Operation inputs and lifecycle, such as `merged`, `unmerged`, `linked`, or `unlinked` |
| `Provenance` | Affected resources and versioned references to pre-change revisions when available |
| `AuditEvent` | Initiator, outcome, service, correlation, and links to the operation Task, Provenance, and domain resources |

`Provenance.agent` currently identifies `Device/mdmbox`; the initiating user or client is recorded in the linked AuditEvent. AuditEvent domain references are unversioned. Merge v2 additionally records actual post-change versions in Provenance and the executed algorithm's identity in Task, including the script SHA-256 and Git revision when applicable. See [Merge operation](merge-operation.md) and [Unmerge operation](unmerge-operation.md) for version and retention requirements.

## Persistence guarantees

Successful merge, unmerge, link, and unlink events commit in the same transaction as their business changes, Task, and Provenance. If any part fails, the entire transaction rolls back, including its success event. A new not-a-match assertion likewise commits its Task and event together. Reusing an assertion still requires a successful audit write.

`$match` and `$referencing` must persist their event before returning data. If the audit write fails, the operation returns HTTP 500 with an OperationOutcome instead of disclosing the result.

Bulk commands start threads and may cancel running SQL, so they cannot share a transaction with their AuditEvent. Before executing a command, MDMbox requires a durable event with `outcomeDesc="Bulk command requested"` and no `outcome`. If that write fails, the command does not run. After synchronous acceptance, MDMbox writes another event with `outcome=0` and `outcomeDesc="Bulk command accepted"`. Acceptance means that the control action was accepted, not that background preparation or matching finished. The two events share the request correlation identifier. If the acceptance write fails after the action, the successful response is preserved and the missing event is logged and counted. A request event without a result is therefore inconclusive: inspect process/job state before retrying.

Bulk status and export endpoints require an event with `outcomeDesc="Bulk data access authorized"` before disclosure. If persistence fails, the API returns HTTP 500 and no result stream opens; Admin UI commands report the error without executing. An export event records authorized access to a result set when the stream opens. Later streaming errors are written to the application log.

Algorithm and Git source mutations, manual Sync, onboarding patient import, and onboarding model installation require an event with `outcomeDesc="UI command requested"` and no `outcome` before executing. Their synchronous result uses `outcomeDesc="UI interaction completed"`. It is best-effort because an audit write cannot roll back an already completed action. Ordinary UI views, reads, onboarding steps, and login/logout also use best-effort result events. An unavailable audit store does not prevent logout from clearing the session cookie.

Manual Git Sync additionally writes one best-effort background result with the same source identifier and request correlation: `Git synchronization completed` with `outcome=0`, or `Git synchronization failed` with `outcome=8`. The synchronous UI result only confirms the start action. A process crash can leave no background result; inspect the source state before retrying. These events do not enumerate scripts. Onboarding test runs also retain the separate audit events produced by their underlying `$match` calls.

Failure events are written separately so that they can survive a business transaction rollback. This is best-effort: if the store rejects the event or is unavailable, MDMbox preserves the original error response and logs the complete event under `Failed to persist operation AuditEvent`. The log includes a process-local loss counter, which resets after restart. An unsuccessful read-audit write is also logged and counted. There is no durable retry queue for these lost local records.

For `$merge`, `$unmerge`, `$link`, and `$unlink`, `preview=true` does not persist an operation event, even if preview validation or computation fails. Authentication rejections or authentication-service failures are audited regardless of preview. Malformed JSON is also audited because the server cannot interpret a preview parameter from it. Sending a preview parameter to `$match`, `$referencing`, or `$mark-not-a-match` does not disable their audit.

## Querying the audit

Use the Aidbox FHIR endpoint, not MDMbox's `/api/fhir` operation endpoints:

```http
GET https://<aidbox-host>/fhir/AuditEvent?source=Device/mdmbox
GET https://<aidbox-host>/fhir/AuditEvent?source=Device/mdmbox&subtype=merge&entity=Patient/123
GET https://<aidbox-host>/fhir/AuditEvent?source=Device/mdmbox&subtype=bulk-match-v2-start
GET https://<aidbox-host>/fhir/AuditEvent?source=Device/mdmbox&entity:identifier=https://mdm.health-samurai.io/fhir/NamingSystem/bulk-match-job|123
GET https://<aidbox-host>/fhir/Provenance?target=Task/<task-id>
```

For failed attempts, request references are stored as identifiers because the referenced resource may not exist. To find failures involving a record, use `entity:identifier`:

```http
GET https://<aidbox-host>/fhir/AuditEvent?source=Device/mdmbox&entity:identifier=https://mdm.health-samurai.io/fhir/NamingSystem/fhir-reference|Patient/123
```

## Access, retention, and export

MDM operation plans cannot create, modify, or delete server-managed Task, Provenance, AuditEvent, or Device resources. This protection does not replace access controls on the Aidbox API. Restrict direct modification of audit resources and `Device/mdmbox`; the observer reference identifies the producer by convention and is not a cryptographic proof of origin.

MDMbox does not currently enforce an audit retention policy or provide tamper-evident storage. Retain the Task, Provenance, and FHIR history versions required for unmerge, and protect audit backups according to your deployment policy.

Aidbox's `BOX_SECURITY_AUDIT_LOG_ENABLED` setting controls its native audit, not these MDM operation events. Configuring `BOX_SECURITY_AUDIT_LOG_REPOSITORY_URL` does not export MDMbox-created AuditEvents: the native sender consumes a separate queue, and creating an AuditEvent through FHIR does not enqueue it. A dedicated MDM event exporter is not implemented. Events remain available locally through FHIR search.
