# JavaScript algorithm API

Use the `input` and `mdm` objects to write algorithms for [server-managed merge](merge-operation.md#server-managed-merge) and [unmerge](unmerge-operation.md#server-managed-unmerge).

Built-in, Git, and database algorithms use the same API. See [Algorithm management](algorithms.md) to create or duplicate a script.

## Entry points and execution

Define a synchronous `function merge(input, mdm)` or `function unmerge(input, mdm)`. Use JSON values: objects, arrays, strings, numbers, booleans, and `null`.

Read resources and build a transaction plan using the functions below. MDMbox validates the returned plan, adds audit resources, and returns a preview or executes it atomically.

Scripts are limited to 100,000 statements and 30 seconds. Resource access uses the documented functions; filesystem and network access are unavailable.

## Input objects

References use `ResourceType/id`, for example `Patient/source` or `Organization/target`. Source and target have the same resource type. Keep version IDs as strings.

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
| `matchVerdict` | `null` |

The pair must exist before the algorithm runs. Use `result` for desired target content and `input.target.meta.versionId` as the target write precondition.

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

Use `provenance.entity[*].what.reference` to read pre-merge snapshots and versioned `provenance.target[*].reference` for post-merge baselines. The Task target and deleted-resource targets are unversioned; not every target is a created resource. An unchanged merge target has its baseline in the Task's `target-version`, exposed by `preMergeTargetVersion`.

The original target and required history must exist. Later merges into the same target must be reversed first.

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

Available functions by operation:

| Function | Merge | Unmerge |
| --- | --- | --- |
| `referencePatchPaths` | Yes | Yes |
| `referencePatchEntries` | Yes | Yes |
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

Reads references to a local `ResourceType/id` in the supplied resource types. Returns one patch target per referencing resource, grouping all matching paths:

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

The keys are `'resource-type'`, `id`, `'version-id'`, `'created-at'`, `'last-updated'`, and `paths`. Use bracket access for hyphenated keys, such as `target['version-id']`. Use `'version-id'` for write preconditions; the two timestamps are strings.

Paths use **FHIRPath**, zero-based array indexes, and point to whole Reference objects. Contained `#id` references are excluded. An empty type array or no matches returns `[]`.

Built-in unmerge algorithms use this function to warn about resources that refer to the target outside the original merge changes. The search is limited to the recorded `relatedResourceTypes`.

### referencePatchEntries(targetReference, patchTargets)

Builds one FHIRPath PATCH Bundle entry per patch target. Each request contains `method: 'PATCH'`, `url: 'ResourceType/id'`, and `ifMatch: 'W/"version"'` from that target's `'version-id'`. Its resource is a FHIR `Parameters` containing `replace` operations. Only `'resource-type'`, `id`, `'version-id'`, and `paths` are needed; timestamp fields are ignored. An empty array returns `[]`.

Both merge and unmerge replace only the `.reference` string by default. They preserve current sibling fields such as `type`, `display`, `identifier`, and extensions. This applies to custom algorithms and the built-in `simple` merge, including references nested inside another Reference's extensions:

```javascript
mdm.referencePatchEntries(input.targetReference, patchTargets);
```

Merge accepts a third argument, `preserveMetadata`, defaulting to `true`. Set it to `false` to replace the whole Reference with `{reference: targetReference}`, removing other fields and extensions. Unmerge takes two arguments and always preserves other fields.

Pass paths to whole Reference objects. For strict unmerge, select them with `referenceFhirPathsToRestoreSource`.

### mutatingRequest(method, reference, versionId)

Builds a Bundle request:

```javascript
mdm.mutatingRequest('PUT', 'Patient/target', '123');
// {method: 'PUT', url: 'Patient/target', ifMatch: 'W/"123"'}
```

Pass the current resource version for PUT, PATCH, or DELETE. MDMbox rejects existing-resource changes without a version precondition. To restore an absent resource, use `putRequestWithPrecondition`.

### transactionBundle(entries)

Returns `{resourceType: 'Bundle', type: 'transaction', entry: entries}`. Supply at least one entry and return the Bundle inside `{plan: bundle}`.

### currentVersion(reference)

**Merge only.** Returns the current version string for a local `ResourceType/id`, or `null` if absent. Pair versions are also available in `input.source` and `input.target`; reference discovery returns related-resource versions.

## Unmerge resource helpers

### fhirGet(reference)

Reads a current or exact historical FHIR resource:

```javascript
mdm.fhirGet('Patient/source');
mdm.fhirGet('Patient/source/_history/123');
```

Returns the FHIR resource with `resourceType`, `id`, and `meta`, or `null` if the requested resource or historical version is absent. Retained history remains readable after deletion. Invalid references and read failures throw errors.

### resourceReference(resource)

Returns `resource.resourceType + '/' + resource.id`. Supply a resource with both fields.

### referenceWithoutHistoryVersion(reference)

Returns `ResourceType/id` from either that local form or `ResourceType/id/_history/version`. Malformed reference structure throws.

### restorableResource(resource)

Returns a copy with `meta.versionId`, `meta.lastUpdated`, and the configured creation-time extension removed. Other metadata is preserved; empty `meta` is omitted.

### resourceCreatedAt(resource)

Returns the configured creation-time extension's `valueInstant` string with its original precision and timezone, or `null` if absent.

### preMergeTargetVersion(mergeTask)

Returns the first saved `target-version` string from the MDM merge Task input code system, or `null` if absent. This is the **pre-merge baseline**, particularly when simple merge did not update target; it is not the current write version.

### hasResourceChangedAfterMerge(currentResource, provenance, preMergeResource?)

Compares the current `meta.versionId` with the matching versioned `provenance.target`. If that baseline is absent, it uses the optional pre-merge resource's version. Supply the latter for a resource left unchanged by merge. A current resource with a version but no baseline is considered changed.

Returns a boolean. A `null` current resource returns `false`; handle deleted resources separately.

### referenceFhirPathsToRestoreSource(preMergeResource, currentResource, sourceReference, targetReference, postMergeResource?)

Returns FHIRPath paths to the original source Reference slots that still point to target and can be reverse-relinked. Returns `[]` if there were no source references, or `null` if any slot is ambiguous; it never returns a partial list.

Every containing array, including ancestor arrays, must equal the corresponding array in `postMergeResource` when that optional baseline is supplied. The built-in `strict` algorithm reads this baseline from the versioned `provenance.target` reference, so its comparison supports both metadata-preserving merges and earlier whole-Reference replacements. Without a baseline, the helper reconstructs the legacy whole-Reference replacement behavior from `preMergeResource`.

The returned paths include source References nested inside another Reference's extensions. Reordering, adding/removing an element, or changing any field inside a source-containing array gives `null`; object key order does not matter. For example, swapping the two elements after `[a → source, b → target]` becomes `[a → target, b → target]` must be refused. Changes outside those arrays, including scalar Reference metadata, are allowed.

The algorithm must separately check changes to the target and recreation of the source or related resources. This helper supports reversing references at their original paths.

### putRequestWithPrecondition(reference, currentResource)

Returns a PUT request with `ifMatch` from `currentResource.meta.versionId`. If `currentResource` is `null`, returns `{method: 'PUT', url: reference, ifNoneMatch: '*'}`. An existing resource without a version throws an error.

This example prepares one restore entry using a versioned reference from `input.provenance.entity[*].what.reference`:

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

The snapshot supplies content; the current resource or its absence supplies the precondition. Intentionally restoring old content does not permit overwriting a concurrent update made while the plan is being computed.

### operationOutcomeIssue(severity, code, message, diagnostics?)

Builds one OperationOutcome issue:

```javascript
mdm.operationOutcomeIssue('warning', 'processing', 'Later changes will be overwritten', 'Observation/related');
// {
//   severity: 'warning', code: 'processing',
//   details: {text: 'Later changes will be overwritten'},
//   diagnostics: 'Observation/related'
// }
```

Supported severities are `information`, `warning`, `error`, and `fatal`. Omitted or `null` diagnostics are left out of the result. This helper is available for unmerge; merge scripts can construct the same issue object directly.

## Algorithm result and errors

Return `{plan: bundle}` when there are no specific messages. To add messages, return `{plan: bundle, outcome: {resourceType: 'OperationOutcome', issue: issues}}`. Omit `outcome` rather than returning `null` or an empty issue list.

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

An `error` or `fatal` outcome returns HTTP 409 and blocks execution. Return `plan: null` to refuse the operation; a supplied plan must still be valid. The `plan` key is required. Script errors, timeouts, and invalid results return HTTP 500 with an OperationOutcome. See the operation pages for other error statuses.

Warnings and information allow a valid plan to proceed. Successful HTTP responses are FHIR `Parameters` with `outcome` and either preview `plan` or execution `task`. MDMbox supplies an informational outcome when the script omits it.

## Server-enforced plan boundaries

Plans must meet these rules:

- Use canonical relative URLs and matching resource identities. Existing-resource changes require the observed version. Use FHIR request fields for preconditions and `fullUrl` only for POST entries.
- Merge must delete the current source version exactly once and cannot otherwise mutate source or delete target. Custom algorithms may also mutate existing resources outside the source-reference scope selected by `related-resource-type`, for example resources explicitly selected through custom parameters. Algorithms validate their own assignment rules. Every mutation is included in the merge audit. Built-in `simple` reassigns only source references in the requested resource types.
- Merge may create resources of other types using unconditional POST with a unique `urn:uuid:` fullUrl. Omit `ifNoneExist`.
- Unmerge must PUT source exactly once, cannot delete target, and cannot use POST. Custom algorithms may also mutate resources absent from the original merge audit, for example caller-selected resources created after merge. Algorithms validate their own assignment rules. Existing-resource mutations require the observed version; restoration of an absent resource requires `ifNoneMatch: '*'`. The unmerge audit records every mutation, including additional resources. Built-in `restore` and `strict` leave resources outside the original merge changes untouched.
- Task, Provenance, AuditEvent, and Device are server-managed and protected from changes in algorithm plans.

Preview executes no writes. For execution, successful business changes, Task, Provenance, and AuditEvent commit or roll back together. Failed non-preview attempts use a separate best-effort AuditEvent write; see [Audit](audit.md). See the operation pages for the built-in restore/strict policies, history retention, and response details.
