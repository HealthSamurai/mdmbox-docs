# JavaScript algorithm API

This page documents the `input` and `mdm` objects available to administrator-written
algorithms for [merge v2](merge-operation.md#server-computed-merge-v2) and
[unmerge v2](unmerge-operation.md#server-computed-unmerge-v2). This is an
in-process JavaScript API, not an HTTP client or part of the OpenAPI specification.
Legacy client-plan operations do not execute these scripts.

The same API is used for built-in, Git, and database algorithms. See
[algorithm management](merge-operation.md#managing-algorithms-in-the-admin-ui)
for creating a script or duplicating a built-in implementation.

## Entry points and execution

Define a synchronous `function merge(input, mdm)` or
`function unmerge(input, mdm)`. Do not return a Promise. The server supplies
`input` and a frozen `mdm` object with only the functions listed below.
Arguments and return values cross the boundary as JSON: use ordinary objects,
arrays, strings, numbers, booleans, and `null`, not JVM objects or JavaScript
classes. Modifying a returned resource only changes the local JavaScript copy.

The API provides reads and plan builders, not immediate writes. Reads use the
operation's database snapshot; constructing a Bundle or PATCH entry does not
execute it. The server validates the returned plan, adds audit resources, and
either returns a preview or executes it atomically. Reading a resource does
not grant permission to mutate it in the plan.

The sandbox has no arbitrary JVM, filesystem, network, subprocess, or guest-thread
access. Each compilation or execution has a 100,000-statement limit and a
30-second wall-clock budget, including host calls. There is no separate guest
heap limit: scripts must be trusted administrator-authored code, not arbitrary
untrusted uploads. There is no `mdm` HTTP, SQL, transaction-execution, or logging
function.

## Input objects

References use `ResourceType/id`, for example `Patient/source` or
`Organization/target`. Source and target have the same resource type; algorithms
must not assume they are Patients. Treat versions as opaque strings, not numbers.

### Merge input

| Field | Value |
| --- | --- |
| `sourceReference` | Source reference |
| `targetReference` | Target reference |
| `parameters` | Full caller-supplied FHIR Parameters resource, including standard and custom parameters |
| `source` | Current source FHIR resource, including `meta.versionId` |
| `target` | Current target FHIR resource, including `meta.versionId` |
| `result` | Requested target content, or `null` if omitted |
| `relatedResourceTypes` | Array of the requested related resource types; `[]` when omitted |
| `matchVerdict` | Currently `null` for v2 HTTP requests; the request parser does not populate this field |

The server checks that the pair exists before running the algorithm. The resource
reader represents an absent resource as `null`; custom scripts should not invent
a replacement source or target. `result` is desired content, not a source of
concurrency metadata: protect target writes with `input.target.meta.versionId`,
not `input.result.meta.versionId`.

### Unmerge input

| Field | Value |
| --- | --- |
| `taskReference` | Reference to the original merge Task |
| `parameters` | Full caller-supplied FHIR Parameters resource, including standard and custom parameters |
| `mergeTask` | Original merge Task FHIR resource, not its subsequently edited current revision |
| `provenance` | Original merge Provenance, with validated versioned post-merge references supplied by the server |
| `sourceReference` | Source reference saved by that merge |
| `targetReference` | Target reference saved by that merge |
| `relatedResourceTypes` | Original Task's saved related-resource-type scope; `[]` if none was recorded |
| `createdAtExtensionUrl` | URL identifying the configured creation-time extension in FHIR `meta.extension` |

Use `provenance.entity[*].what.reference` to read pre-merge snapshots and
versioned `provenance.target[*].reference` for post-merge baselines. The Task
target and deleted-resource targets are unversioned; not every target is a
created resource. An unchanged merge target has its baseline in the Task's
`target-version`, exposed by `preMergeTargetVersion`.

The original target must still exist. Audit/history checks and LIFO validation run on the server before the script.

### Custom parameters (merge and unmerge)

Both `$merge/v2` and `$unmerge/v2` pass the full caller-supplied FHIR Parameters resource as `input.parameters`. This includes standard operation parameters, additional named parameters, nested `part`, embedded `resource`, all `value[x]` fields, repeated parameters in their original order, and resource metadata. The selected algorithm interprets and validates its additional parameters; built-in algorithms ignore them.

For example, a caller can append this item to the request's `parameter` array when selecting a custom algorithm that supports it:

```json
{
  "name": "options",
  "part": [
    { "name": "keep-identifiers", "valueBoolean": true },
    { "name": "reason", "valueString": "Reviewed duplicate" }
  ]
}
```

Inside either `merge(input, mdm)` or `unmerge(input, mdm)`, read it from the same location:

```javascript
const options = input.parameters.parameter.find(p => p.name === 'options');
const keepIdentifiers = options?.part?.find(p => p.name === 'keep-identifiers')?.valueBoolean;
```

Custom parameters remain inside `input.parameters` and cannot replace server-supplied context fields such as `input.source`, `input.target`, or `input.provenance`. The request's `preview` parameter is included there; algorithms should compute the same plan for preview and execution. The server decides whether to execute it.

## Function availability

These are the complete registered function sets. Helpers described as unmerge-only
are not available from `merge`, even if they would be useful there.

| Function | Merge | Unmerge |
| --- | --- | --- |
| `referencePatchPaths` | Yes | Yes |
| `referencePatchEntries` | Yes | Yes, with different Reference replacement behavior |
| `mutatingRequest` | Yes | Yes |
| `transactionBundle` | Yes | Yes |
| `currentVersion` | Yes | No |
| `fhirGet` | No | Yes |
| `resourceReference` | No | Yes |
| `referenceWithoutHistoryVersion` | No | Yes |
| `restorableResource` | No | Yes |
| `resourceCreatedAt` | No | Yes |
| `hasResourceChangedAfterMerge` | No | Yes |
| `referenceFhirPathsToRestoreSource` | No | Yes |
| `preMergeTargetVersion` | No | Yes |
| `putRequestWithPrecondition` | No | Yes |
| `operationOutcomeIssue` | No | Yes |

## Reference discovery and plan builders

### referencePatchPaths(reference, resourceTypes)

Reads references to a local `ResourceType/id` in the supplied resource types.
Returns one patch target per referencing resource, grouping all matching paths:

```javascript
const targets = mdm.referencePatchPaths('Patient/source', ['Observation']);
// Example target; timestamps are additional metadata described below:
// {
//   'resource-type': 'Observation',
//   id: 'related',
//   'version-id': '123',
//   paths: ['Observation.subject', 'Observation.performer[0]']
// }
```

The exact keys are `'resource-type'`, `id`, `'version-id'`, `'created-at'`,
`'last-updated'`, and `paths`. The hyphenated keys require bracket access in JS,
for example `target['version-id']`. The timestamp fields are storage timestamp
strings, not a replacement for FHIR `meta`; do not use them as version tokens.

Paths are zero-based **FHIRPath** paths to whole Reference objects, not JSONPath,
JSON Pointer, or paths to their `.reference` fields. Storage-specific reference
shapes are converted to FHIR paths. Contained `#id` references are excluded.
An empty type array or no matches returns `[]`. Pass the operation's recorded
scope rather than inferring extra types from audit snapshots.

Both built-in unmerge algorithms use this discovery to warn about target-referencing resources outside the merge changes. They exclude the references represented by pre-merge snapshots and `provenance.target`, preserving all remaining resources regardless of age. This is a snapshot search, not a claim about creation or commit order. The former `resourceReferencesCreatedAfter` helper and `input.mergeCreatedAt` are no longer exposed; custom algorithms should use reference discovery and audit membership instead of timestamp-based classification.

### referencePatchEntries(targetReference, patchTargets)

Builds one FHIRPath PATCH Bundle entry per patch target. Each request contains
`method: 'PATCH'`, `url: 'ResourceType/id'`, and `ifMatch: 'W/"version"'` from
that target's `'version-id'`. Its resource is a FHIR `Parameters` containing
`replace` operations. Only `'resource-type'`, `id`, `'version-id'`, and `paths`
are needed; timestamp fields are ignored. An empty array returns `[]`.

The default behavior depends on the operation:

- **Merge:** replaces the whole Reference with `{reference: targetReference}`.
  Existing `display`, `identifier`, or extensions on that Reference are removed.
  Merge also accepts a third boolean argument, `preserveMetadata`; passing
  `true` replaces only the `.reference` string. The default is `false`.
- **Unmerge:** always replaces only the `.reference` string, preserving current
  sibling fields. Its JS function accepts two arguments, not a third override.

Do not append `.reference` to the input paths yourself. For strict unmerge,
use paths selected by `referenceFhirPathsToRestoreSource`, not every reference
currently pointing to target.

### mutatingRequest(method, reference, versionId)

Builds a Bundle request without reading or writing anything:

```javascript
mdm.mutatingRequest('PUT', 'Patient/target', '123');
// {method: 'PUT', url: 'Patient/target', ifMatch: 'W/"123"'}
```

Pass the current snapshot version for PUT, PATCH, or DELETE. Passing `null` as
the third argument omits `ifMatch`; this helper does not validate the request.
Such an unprotected mutation is rejected by the v2 plan boundary. For restoring
an absent resource, use unmerge's `putRequestWithPrecondition` instead.

### transactionBundle(entries)

Returns `{resourceType: 'Bundle', type: 'transaction', entry: entries}` without
validation or execution. Return it inside `{plan: bundle}`, not directly.
The server rejects an empty executable plan.

### currentVersion(reference)

**Merge only.** Reads the current version string for a local `ResourceType/id`,
or returns `null` if absent. For the pair, prefer versions already supplied in
`input.source` and `input.target`; discovery results contain related-resource
versions. This function does not read historical versions or return a resource.

## Unmerge resource helpers

### fhirGet(reference)

Reads a current or exact historical FHIR resource:

```javascript
mdm.fhirGet('Patient/source');
mdm.fhirGet('Patient/source/_history/123');
```

Returns the resource directly, with `resourceType`, `id`, and `meta`, or `null`
when absent, including a deleted current resource or an unavailable historical
version. A current deletion does not prevent reading retained earlier versions.
There is no `{resource, versionId, created}` wrapper. Versioned references must
identify an exact version; there is no substitution with the latest resource.

This is not general HTTP: searches, absolute URLs, arbitrary endpoints, and
contained references are outside its supported contract. Invalid reference
structure and host read failures can throw; do not treat exceptions as normal
`null` results. The former
`readCurrentResource`, `readHistoricalResource`, and `readOperationResource`
functions are not exposed to JavaScript.

### resourceReference(resource)

Returns `resource.resourceType + '/' + resource.id`. Supply an identified FHIR
resource; the helper does not validate missing fields or append a history suffix.

### referenceWithoutHistoryVersion(reference)

Returns `ResourceType/id` from either that local form or
`ResourceType/id/_history/version`. Malformed reference structure throws.

### restorableResource(resource)

Returns a copy without `meta.versionId`, `meta.lastUpdated`, and the configured
creation-time extension. Other metadata, including profiles, tags, security
labels, and unrelated extensions, is preserved. Empty `meta` is omitted.
This does not read current state or supply a write precondition.

### resourceCreatedAt(resource)

Returns the configured creation-time extension's `valueInstant` string, retaining
its precision and timezone, or `null` if the resource or extension is absent.
It is not `meta.lastUpdated`. Use the helper instead of hard-coding the
extension URL or rounding it through JavaScript `Date`.

### preMergeTargetVersion(mergeTask)

Returns the first saved `target-version` string from the MDM merge Task input
code system, or `null` if absent. This is the **pre-merge baseline**, particularly
when simple merge did not update target; it is not the current write version.

### hasResourceChangedAfterMerge(currentResource, provenance, preMergeResource?)

Compares the current `meta.versionId` with the matching versioned
`provenance.target`. If that baseline is absent, it uses the optional pre-merge
resource's version. Supply the latter for a resource left unchanged by merge.
A current resource with a version but no baseline is considered changed.

Returns a boolean; `null` current state returns `false`, so the caller must
handle deletion separately. It performs no database read, does not compare
timestamps, and does not establish whether a resource was created by merge.

### referenceFhirPathsToRestoreSource(preMergeResource, currentResource, sourceReference, targetReference)

Returns FHIRPath paths to the original source Reference slots that still point
to target and can be reverse-relinked. Returns `[]` if there were no source
references, or `null` if any slot is ambiguous; it never returns a partial list.

This models simple's whole-Reference replacement. Every containing array,
including ancestor arrays, must equal the expected post-merge array. Reordering,
adding/removing an element, or changing any field inside such an array gives
`null`; object key order does not matter. For example, swapping the two elements
after `[a → source, b → target]` becomes `[a → target, b → target]` must be refused.
Changes outside those arrays, including scalar Reference metadata, are allowed.

The helper does not check target drift, source recreation, or related-resource
deletion/recreation, build PATCH entries, or return an OperationOutcome. Those
checks belong to the algorithm. It is not a universal inverse for custom merges;
changing simple's metadata replacement policy may also change the expected arrays.

### putRequestWithPrecondition(reference, currentResource)

Returns a PUT request with `ifMatch` from the current resource's `meta.versionId`.
If `currentResource` is `null`, returns
`{method: 'PUT', url: reference, ifNoneMatch: '*'}`. An existing resource without
a version throws instead of producing an unconditional write. It does not read
the database or check that the supplied resource identifies `reference`.

For a versioned reference from `input.provenance.entity[*].what.reference`,
the following fragment prepares one restore entry, not a complete unmerge:

```javascript
const snapshot = mdm.fhirGet(versionReference);
if (snapshot == null) {
  throw new Error('Required historical resource is missing');
}
const reference = mdm.resourceReference(snapshot);
const current = mdm.fhirGet(reference);
const entry = {
  resource: mdm.restorableResource(snapshot),
  request: mdm.putRequestWithPrecondition(reference, current)
};
```

The snapshot supplies content; the current resource or its absence supplies the
precondition. Intentionally restoring old content does not permit overwriting
a concurrent update made while the plan is being computed.

### operationOutcomeIssue(severity, code, message, diagnostics?)

Builds one issue, not a complete OperationOutcome:

```javascript
mdm.operationOutcomeIssue('warning', 'processing', 'Later changes will be overwritten', 'Observation/related');
// {
//   severity: 'warning', code: 'processing',
//   details: {text: 'Later changes will be overwritten'},
//   diagnostics: 'Observation/related'
// }
```

Omitted/null diagnostics are omitted from the result. Supported result severities
are `information`, `warning`, `error`, and `fatal`. The helper constructs data;
it does not validate issue codes or log anything. Keep messages and diagnostics
free of clinical payloads, credentials, and tokens. Merge scripts construct the
same issue shape directly; this convenience helper is currently unmerge-only.

## Algorithm result and errors

Return `{plan: bundle}` when there are no specific messages. To add messages,
return `{plan: bundle, outcome: {resourceType: 'OperationOutcome', issue: issues}}`.
Omit `outcome` rather than returning `null` or an empty issue list.

For an expected business conflict, return an error/fatal outcome and `plan: null`:

```javascript
return {
  plan: null,
  outcome: {
    resourceType: 'OperationOutcome',
    issue: [{severity: 'error', code: 'conflict', details: {text: 'References cannot be safely restored'}}]
  }
};
```

Such an outcome returns HTTP 409 and blocks execution. If a non-null plan is
supplied alongside a blocking outcome, it must still pass plan validation.
Use `plan: null` for a deliberate refusal. The `plan` key is always required.
Uncaught script/host errors, timeouts, and invalid algorithm results return HTTP
500 with an OperationOutcome, not a successful partial plan. Server state checks
and FHIR execution errors have their own statuses described on the operation pages.

Warnings/information do not block a valid plan. Successful HTTP responses are
FHIR `Parameters` with `outcome` and either preview `plan` or execution `task`,
not the raw JS result. The server supplies an informational outcome if omitted.

## Server-enforced plan boundaries

Builders do not bypass validation, including during preview:

- Use canonical relative URLs and matching resource identities. Existing-resource
  mutations require the version observed in the operation snapshot. Non-POST
  entries must omit `fullUrl`; use FHIR request fields, not custom HTTP headers.
- Merge must delete the current source version exactly once, cannot otherwise
  mutate source or delete target, and may change only the pair and related
  resources discovered in the selected source-reference scope.
- Merge may create other resources with unconditional POST and a unique stable
  `urn:uuid:` fullUrl. It cannot create another resource of the pair's type.
  Conditional creation (`ifNoneExist`, including null/empty values, or the
  equivalent header) is forbidden.
- Unmerge must PUT source exactly once, cannot delete target, and cannot use POST. Both built-in and custom algorithms may mutate only the source, target, and resources represented in the original merge Provenance. Resources outside that audit scope cannot be added to the reversal plan. Existing-resource mutations require the observed version; restoration of an absent resource requires `ifNoneMatch: '*'`. The unmerge audit records every mutation.
- Task, Provenance, AuditEvent, and Device are server-managed and cannot be
  added, changed, or removed by algorithm plans. The server owns audit assembly
  and lifecycle changes, including marking the original Task unmerged.

Preview executes no writes. For execution, successful business changes, Task, Provenance, and AuditEvent commit or roll back together. Failed non-preview attempts use a separate best-effort AuditEvent write; see [Audit](audit.md). See the operation pages for the built-in restore/strict policies, history retention, and response details.
